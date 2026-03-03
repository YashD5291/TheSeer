import { createEditor } from './codemirror-setup.js';
import type { EditorPayload, RecompileResponse } from '../shared/types.js';
import type { EditorView } from 'codemirror';

const TAG = '[Seer Editor]';
const PREAMBLE_MARKER = '\\sbox\\ANDbox';
const AUTO_COMPILE_DELAY = 2000;

// ── State ────────────────────────────────────────────────────────────
let payload: EditorPayload | null = null;
let frozenPreamble = '';
let editableContent = '';
let lastCompiledContent = '';
let currentContent = '';
let isDirty = false;
let isEditing = false;
let isCompiling = false;
let autoCompile = false;
let autoCompileTimer: ReturnType<typeof setTimeout> | null = null;
let currentBlobUrl: string | null = null;
let editorView: EditorView | null = null;

// ── DOM refs ─────────────────────────────────────────────────────────
const $ = (id: string) => document.getElementById(id)!;

// ── Init ─────────────────────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(window.location.search);
  const tabId = params.get('tab');
  if (!tabId) {
    showError('No tab parameter in URL');
    return;
  }

  const key = `seer_editor_${tabId}`;
  const data = await chrome.storage.session.get(key);
  payload = data[key] as EditorPayload | undefined ?? null;

  if (!payload?.pdfBase64 || !payload?.latexSource) {
    showError('Resume data not found. The session may have expired — try generating the resume again.');
    return;
  }

  console.log(`${TAG} Loaded editor for ${payload.folderName}`);

  // Set header title
  const title = (payload.jobCompany && payload.jobTitle)
    ? `${payload.jobCompany} — ${payload.jobTitle}`
    : payload.folderName;
  $('header-title').textContent = title;
  document.title = `The Seer — ${title}`;

  // Split LaTeX
  const { preamble, content } = splitLatex(payload.latexSource);
  frozenPreamble = preamble;
  editableContent = content;
  lastCompiledContent = content;
  currentContent = content;

  // Render PDF
  updatePdfPreview(payload.pdfBase64);
  $('pdf-loading').classList.add('hidden');

  // Wire up buttons
  $('btn-edit').addEventListener('click', enterEditMode);
  $('btn-download').addEventListener('click', downloadPdf);
  $('btn-recompile').addEventListener('click', () => recompile());
  $('btn-save').addEventListener('click', save);
  $('btn-close-editor').addEventListener('click', tryExitEditMode);
  $('auto-toggle').addEventListener('click', toggleAutoCompile);
  $('modal-cancel').addEventListener('click', () => $('confirm-modal').classList.add('hidden'));
  $('modal-discard').addEventListener('click', () => {
    $('confirm-modal').classList.add('hidden');
    exitEditMode(true);
  });
  $('error-dismiss').addEventListener('click', () => $('error-bar').classList.add('hidden'));

  // Warn on tab close with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// ── LaTeX Splitting ──────────────────────────────────────────────────
function splitLatex(fullSource: string): { preamble: string; content: string } {
  const lines = fullSource.split('\n');
  const markerIdx = lines.findIndex(l => l.includes(PREAMBLE_MARKER));
  if (markerIdx === -1) {
    console.warn(`${TAG} Preamble marker not found — showing full source`);
    return { preamble: '', content: fullSource };
  }
  return {
    preamble: lines.slice(0, markerIdx + 1).join('\n'),
    content: lines.slice(markerIdx + 1).join('\n'),
  };
}

function joinLatex(preamble: string, content: string): string {
  if (!preamble) return content;
  return preamble + '\n' + content;
}

// ── PDF Preview ──────────────────────────────────────────────────────
function updatePdfPreview(base64: string) {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/pdf' });
  currentBlobUrl = URL.createObjectURL(blob);
  ($('pdf-embed') as HTMLEmbedElement).src = currentBlobUrl;
}

function downloadPdf() {
  if (!currentBlobUrl || !payload) return;
  const a = document.createElement('a');
  a.href = currentBlobUrl;
  a.download = `${payload.folderName}.pdf`;
  a.click();
}

// ── Edit Mode Toggle ─────────────────────────────────────────────────
function enterEditMode() {
  if (isEditing) return;
  isEditing = true;

  // Initialize CodeMirror on first entry
  if (!editorView) {
    editorView = createEditor(
      $('codemirror-container'),
      editableContent,
      onEditorChange,
    );
  }

  // Animate split
  $('code-pane').classList.add('visible');
  $('pdf-pane').classList.add('split');

  // Swap header buttons
  $('preview-buttons').classList.add('hidden');
  $('edit-buttons').classList.remove('hidden');
  $('edit-buttons').classList.add('flex');

  // Show status bar
  $('status-bar').classList.remove('hidden');
  $('status-bar').classList.add('flex');

  console.log(`${TAG} Entered edit mode`);
}

function tryExitEditMode() {
  if (isDirty) {
    $('confirm-modal').classList.remove('hidden');
  } else {
    exitEditMode(false);
  }
}

function exitEditMode(discardChanges: boolean) {
  if (discardChanges && editorView) {
    // Reset editor content to last compiled version
    const transaction = editorView.state.update({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: lastCompiledContent,
      },
    });
    editorView.dispatch(transaction);
    currentContent = lastCompiledContent;
    isDirty = false;
  }

  isEditing = false;

  // Animate collapse
  $('code-pane').classList.remove('visible');
  $('pdf-pane').classList.remove('split');

  // Swap header buttons
  $('preview-buttons').classList.remove('hidden');
  $('edit-buttons').classList.add('hidden');
  $('edit-buttons').classList.remove('flex');

  // Hide status bar and error bar
  $('status-bar').classList.add('hidden');
  $('status-bar').classList.remove('flex');
  $('error-bar').classList.add('hidden');

  // Update dirty indicator
  updateDirtyIndicator();

  console.log(`${TAG} Exited edit mode`);
}

// ── Editor Change Handler ────────────────────────────────────────────
function onEditorChange(content: string) {
  currentContent = content;
  isDirty = content !== lastCompiledContent;
  updateDirtyIndicator();

  if (autoCompile && !isCompiling) {
    if (autoCompileTimer) clearTimeout(autoCompileTimer);
    autoCompileTimer = setTimeout(() => recompile(), AUTO_COMPILE_DELAY);
  }
}

function updateDirtyIndicator() {
  const indicator = $('dirty-indicator');
  if (isDirty) {
    indicator.classList.remove('hidden');
  } else {
    indicator.classList.add('hidden');
  }
}

// ── Auto-Compile Toggle ─────────────────────────────────────────────
function toggleAutoCompile() {
  autoCompile = !autoCompile;
  const toggle = $('auto-toggle');
  if (autoCompile) {
    toggle.classList.add('active');
  } else {
    toggle.classList.remove('active');
    if (autoCompileTimer) {
      clearTimeout(autoCompileTimer);
      autoCompileTimer = null;
    }
  }
}

// ── Recompile ────────────────────────────────────────────────────────
async function recompile(): Promise<boolean> {
  if (isCompiling || !payload) return false;
  isCompiling = true;

  // Clear any pending auto-compile
  if (autoCompileTimer) {
    clearTimeout(autoCompileTimer);
    autoCompileTimer = null;
  }

  setStatus('compiling', 'Compiling...');
  $('btn-recompile').setAttribute('disabled', '');
  $('error-bar').classList.add('hidden');

  const fullSource = joinLatex(frozenPreamble, currentContent);
  const startTime = Date.now();

  try {
    const response: RecompileResponse = await chrome.runtime.sendMessage({
      type: 'SEER_RECOMPILE',
      texSource: fullSource,
      texPath: payload.texPath,
      folderPath: payload.folderPath,
      folderName: payload.folderName,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (response.success && response.pdfBase64) {
      updatePdfPreview(response.pdfBase64);
      lastCompiledContent = currentContent;
      isDirty = false;
      updateDirtyIndicator();

      const sizeKb = response.pdfSizeBytes ? `${(response.pdfSizeBytes / 1024).toFixed(0)} KB` : '';
      setStatus('success', `Compiled in ${elapsed}s${sizeKb ? ` (${sizeKb})` : ''}`);
      console.log(`${TAG} Recompile success: ${elapsed}s`);

      isCompiling = false;
      $('btn-recompile').removeAttribute('disabled');
      return true;
    } else {
      setStatus('error', `Compilation failed (${elapsed}s)`);
      if (response.error || response.compilerOutput) {
        showCompilerError(response.error || '', response.compilerOutput || '');
      }
      console.error(`${TAG} Recompile failed:`, response.error);

      isCompiling = false;
      $('btn-recompile').removeAttribute('disabled');
      return false;
    }
  } catch (err) {
    setStatus('error', 'Compilation failed — native host error');
    console.error(`${TAG} Recompile error:`, err);
    isCompiling = false;
    $('btn-recompile').removeAttribute('disabled');
    return false;
  }
}

// ── Save ─────────────────────────────────────────────────────────────
async function save() {
  const success = await recompile();
  if (success && payload) {
    // Update session storage with new content
    const fullSource = joinLatex(frozenPreamble, currentContent);
    payload.latexSource = fullSource;
    payload.pdfBase64 = currentBlobUrl ? '' : payload.pdfBase64; // will be updated below

    // Re-read the payload to get fresh pdfBase64 from recompile
    const params = new URLSearchParams(window.location.search);
    const tabId = params.get('tab');
    if (tabId) {
      const updatedPayload: EditorPayload = {
        ...payload,
        latexSource: fullSource,
      };
      await chrome.storage.session.set({ [`seer_editor_${tabId}`]: updatedPayload });
      console.log(`${TAG} Saved to session storage`);
    }
  }
}

// ── Status Bar ───────────────────────────────────────────────────────
function setStatus(state: 'idle' | 'compiling' | 'success' | 'error', text: string) {
  const el = $('status-text');
  el.className = `status-${state}`;

  if (state === 'compiling') {
    el.innerHTML = `<span class="spinner"></span>${text}`;
  } else {
    const dot = state === 'success' ? '\u25CF ' : state === 'error' ? '\u2716 ' : '\u25CF ';
    el.textContent = dot + text;
  }

  if (state === 'success' || state === 'error') {
    $('status-time').textContent = new Date().toLocaleTimeString();
  }
}

function showCompilerError(error: string, compilerOutput: string) {
  const details = compilerOutput || error;
  if (!details) return;
  $('error-details').textContent = details;
  $('error-bar').classList.remove('hidden');
}

function showError(message: string) {
  $('pdf-loading').textContent = message;
  $('pdf-loading').classList.remove('hidden');
  $('pdf-loading').classList.add('text-red-400');
}

// ── Bootstrap ────────────────────────────────────────────────────────
init().catch(err => {
  console.error(`${TAG} Init failed:`, err);
  showError(`Failed to initialize: ${err.message}`);
});
