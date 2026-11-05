/**
 * Moves the same player between its reply card and viewport presentation.
 * CSS owns both layouts; only a transform is animated between their rectangles.
 */
export class PresentationMotion {
  constructor({ player, root, reducedMotion = false, backgroundElements = [] }) {
    if (!player || !root) throw new TypeError('PresentationMotion requires player and root elements');
    this.player = player;
    this.root = root;
    this.reducedMotion = Boolean(reducedMotion);
    this.backgroundElements = [...new Set(backgroundElements)].filter(Boolean);
    this._phase = 'inline';
    this._pending = null;
    this._originalStyles = null;
    this._backgroundState = null;
    this._previousFocus = null;
  }

  get active() { return this._phase !== 'inline'; }
  get phase() { return this._phase; }

  expand() {
    if (this._phase === 'expanded') return Promise.resolve(true);
    if (this._phase === 'expanding' && this._pending) return this._pending.promise;

    // Read the visible, possibly mid-transition rectangle before canceling it.
    const from = this._rectangle();
    this._cancelPending();
    this._rememberStyles();
    this._lockBackground();
    this.player.classList.add('is-expanded');
    this.root.classList.add('is-presenting');
    this._phase = 'expanding';
    this._focusPlayer();
    const full = this._rectangle();

    return this._transition(
      [{ transform: this._transform(from, full) }, { transform: 'none' }],
      900,
      () => this._finishExpanded(),
      this._usable(from) && this._usable(full),
    );
  }

  collapse() {
    if (this._phase === 'inline') return Promise.resolve(true);
    if (this._phase === 'collapsing' && this._pending) return this._pending.promise;

    const from = this._rectangle();
    this._cancelPending();
    this._rememberStyles();
    // These reads/writes are in one task; the intermediate inline layout does
    // not paint. Re-measuring also supports a resized or scrolled chat panel.
    this.root.classList.remove('is-presenting');
    this.player.classList.remove('is-expanded');
    const destination = this._rectangle();
    this.player.classList.add('is-expanded');
    const full = this._rectangle();
    this._phase = 'collapsing';

    return this._transition(
      [{ transform: this._transform(from, full) }, { transform: this._transform(destination, full) }],
      650,
      () => this._finishInline(),
      this._usable(from) && this._usable(destination) && this._usable(full),
    );
  }

  reset() {
    this._cancelPending();
    this._finishInline();
  }

  // A resize invalidates a FLIP rectangle. Snap to the requested endpoint and
  // settle the original promise so an awaiting finish() can still proceed.
  refresh() {
    if (this._pending) this._complete(this._pending, true);
    else if (this._phase === 'expanded') this._finishExpanded();
  }

  _rectangle() {
    try {
      const r = this.player.getBoundingClientRect();
      return { left: Number(r.left ?? r.x), top: Number(r.top ?? r.y), width: Number(r.width), height: Number(r.height) };
    } catch { return { left: 0, top: 0, width: 0, height: 0 }; }
  }

  _usable(rect) {
    return Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0;
  }

  _transform(rect, full) {
    if (!this._usable(rect) || !this._usable(full)) return 'none';
    const x = rect.left - full.left;
    const y = rect.top - full.top;
    return `translate(${x}px, ${y}px) scale(${rect.width / full.width}, ${rect.height / full.height})`;
  }

  _rememberStyles() {
    if (!this._originalStyles) {
      this._originalStyles = {
        transformOrigin: this.player.style.transformOrigin,
        willChange: this.player.style.willChange,
      };
    }
    this.player.style.transformOrigin = '0 0';
    this.player.style.willChange = 'transform';
  }

  _restoreStyles() {
    if (!this._originalStyles) return;
    this.player.style.transformOrigin = this._originalStyles.transformOrigin;
    this.player.style.willChange = this._originalStyles.willChange;
  }

  _lockBackground() {
    if (this._backgroundState) return;
    this._backgroundState = new Map();
    this._previousFocus = this.player.ownerDocument?.activeElement || null;
    for (const element of this.backgroundElements) {
      // Inert must never be set on an ancestor of the actual player.
      if (element === this.player || element.contains?.(this.player)) continue;
      this._backgroundState.set(element, Boolean(element.inert));
      element.inert = true;
    }
  }

  _focusPlayer() {
    try { this.player.focus({ preventScroll: true }); } catch { /* Focus is optional in non-visual environments. */ }
  }

  _unlockBackground() {
    for (const [element, wasInert] of this._backgroundState || []) element.inert = wasInert;
    this._backgroundState = null;
    const previous = this._previousFocus;
    this._previousFocus = null;
    const current = this.player.ownerDocument?.activeElement;
    const focusIsInside = current === this.player || this.player.contains?.(current);
    if (focusIsInside && previous && previous !== this.player && previous.isConnected !== false && !previous.hidden && !previous.disabled) {
      try { previous.focus({ preventScroll: true }); } catch { /* A removed/hidden control need not regain focus. */ }
    }
  }

  _transition(keyframes, duration, finish, hasGeometry) {
    if (this.reducedMotion || typeof this.player.animate !== 'function' || !hasGeometry) {
      finish();
      return Promise.resolve(true);
    }

    let resolve;
    const promise = new Promise(settle => { resolve = settle; });
    const pending = { promise, resolve, finish, animation: null };
    this._pending = pending;
    try {
      const animation = this.player.animate(keyframes, {
        duration,
        easing: 'cubic-bezier(.22,1,.36,1)',
        fill: 'both',
      });
      pending.animation = animation;
      animation.onfinish = () => this._complete(pending, true);
      // External cancellation snaps to its intended endpoint rather than
      // leaving focus/inert/classes in an intermediate state.
      animation.oncancel = () => this._complete(pending, false);
    } catch {
      this._complete(pending, true);
    }
    return promise;
  }

  _detachAndCancel(pending) {
    const animation = pending?.animation;
    if (!animation) return;
    animation.onfinish = null;
    animation.oncancel = null;
    try { animation.cancel(); } catch { /* Already-finished animations are harmless. */ }
  }

  _complete(pending, success) {
    if (this._pending !== pending) return;
    this._pending = null;
    this._detachAndCancel(pending);
    pending.finish();
    pending.resolve(success);
  }

  _cancelPending() {
    const pending = this._pending;
    if (!pending) return;
    this._pending = null;
    this._detachAndCancel(pending);
    pending.resolve(false);
  }

  _finishExpanded() {
    this.player.classList.add('is-expanded');
    this.root.classList.add('is-presenting');
    this._phase = 'expanded';
    this._restoreStyles();
  }

  _finishInline() {
    this.player.classList.remove('is-expanded');
    this.root.classList.remove('is-presenting');
    this._phase = 'inline';
    this._restoreStyles();
    this._originalStyles = null;
    this._unlockBackground();
  }
}
