import { Component } from '@theme/component';
import { CartAddEvent } from '@theme/events';
import { fetchConfig } from '@theme/utilities';

/**
 * @typedef {object} PairsWithVariant
 * @property {number} id
 * @property {string} title
 * @property {boolean} available
 * @property {string} price
 * @property {string[]} options
 */

/**
 * @typedef {object} PairsWithItemRefs
 * @property {HTMLSelectElement} [sizeSelect]
 * @property {HTMLButtonElement} addButton
 * @property {HTMLElement} [price]
 * @property {HTMLInputElement} variantId
 * @property {HTMLScriptElement} variantsJson
 */

/**
 * Single pairs-with product card: size selection + add to cart.
 * @extends {Component<PairsWithItemRefs>}
 */
class PairsWithItem extends Component {
  requiredRefs = ['addButton', 'variantId', 'variantsJson'];

  /** @type {PairsWithVariant[]} */
  #variants = [];

  /** @type {number} */
  #optionIndex = 0;

  /** @type {boolean} */
  #adding = false;

  connectedCallback() {
    super.connectedCallback();

    try {
      this.#variants = JSON.parse(this.refs.variantsJson.textContent || '[]');
    } catch {
      this.#variants = [];
    }

    this.#optionIndex = Number(this.dataset.optionIndex || 0);

    if (this.dataset.singleVariant === 'true') {
      this.#enableAdd();
    }
  }

  /**
   * Theme event handlers receive a proxied event where `target` is the element
   * with the `on:*` attribute. `currentTarget` is the document listener.
   * @param {Event} event
   */
  handleSizeChange(event) {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;

    const value = select.value;

    if (!value) {
      this.#disableAdd();
      return;
    }

    const variant = this.#findVariantForOption(value);

    if (!variant) {
      this.#disableAdd();
      return;
    }

    this.refs.variantId.value = String(variant.id);

    if (this.refs.price) {
      this.refs.price.textContent = variant.price;
    }

    if (variant.available) {
      this.#enableAdd();
    } else {
      this.#disableAdd();
    }
  }

  /**
   * @param {Event} event
   */
  async handleAdd(event) {
    event.preventDefault();
    event.stopPropagation();

    if (this.#adding) return;

    const variantId = this.refs.variantId.value;
    if (!variantId || this.refs.addButton.disabled) return;

    this.#adding = true;
    this.refs.addButton.disabled = true;

    const formData = new FormData();
    formData.append('id', variantId);
    formData.append('quantity', '1');

    const cartItemsComponents = document.querySelectorAll('cart-items-component');
    /** @type {string[]} */
    const sectionIds = [];
    cartItemsComponents.forEach((item) => {
      if (item instanceof HTMLElement && item.dataset.sectionId) {
        sectionIds.push(item.dataset.sectionId);
      }
    });
    if (sectionIds.length) {
      formData.append('sections', sectionIds.join(','));
    }

    const fetchCfg = fetchConfig('javascript', { body: formData });

    try {
      const response = await fetch(Theme.routes.cart_add_url, {
        ...fetchCfg,
        headers: {
          ...fetchCfg.headers,
          Accept: 'application/json',
        },
      });
      const data = await response.json();

      if (data.status) {
        console.error(data.description || data.message);
        this.#reenableAfterAdd();
        return;
      }

      document.dispatchEvent(
        new CartAddEvent(data, this.id || variantId, {
          source: 'pairs-with',
          productId: this.dataset.productId,
          variantId,
          itemCount: 1,
          sections: data.sections,
        })
      );

      this.#openCartDrawer();
      this.#reenableAfterAdd();
    } catch (error) {
      console.error(error);
      this.#reenableAfterAdd();
    } finally {
      this.#adding = false;
    }
  }

  /**
   * @param {string} optionValue
   * @returns {PairsWithVariant | undefined}
   */
  #findVariantForOption(optionValue) {
    const normalized = optionValue.trim();
    const matches = this.#variants.filter(
      (item) => String(item.options[this.#optionIndex] ?? '').trim() === normalized
    );

    return matches.find((item) => item.available) || matches[0];
  }

  #openCartDrawer() {
    const cartDrawer = document.querySelector('cart-drawer-component');
    if (cartDrawer && 'open' in cartDrawer && typeof cartDrawer.open === 'function') {
      cartDrawer.open();
    }
  }

  #reenableAfterAdd() {
    if (this.dataset.singleVariant === 'true' || this.refs.sizeSelect?.value) {
      const variant = this.#variants.find((item) => String(item.id) === this.refs.variantId.value);
      if (variant?.available) this.#enableAdd();
    }
  }

  #enableAdd() {
    this.refs.addButton.disabled = false;
    this.refs.addButton.classList.add('pairs-with-card__add--ready');
  }

  #disableAdd() {
    this.refs.addButton.disabled = true;
    this.refs.addButton.classList.remove('pairs-with-card__add--ready');
  }
}

/**
 * @typedef {object} PairsWithRefs
 * @property {HTMLElement} track
 * @property {HTMLButtonElement} prev
 * @property {HTMLButtonElement} next
 */

/**
 * Pairs With carousel container.
 * @extends {Component<PairsWithRefs>}
 */
class PairsWith extends Component {
  requiredRefs = ['track', 'prev', 'next'];

  connectedCallback() {
    super.connectedCallback();
    this.#updateButtons();
    this.refs.track.addEventListener('scroll', () => this.#updateButtons(), { passive: true });
  }

  scrollPrev() {
    this.#scrollBy(-1);
  }

  scrollNext() {
    this.#scrollBy(1);
  }

  /**
   * @param {number} direction
   */
  #scrollBy(direction) {
    const track = this.refs.track;
    const card = track.querySelector('.pairs-with-card');
    if (!card) return;

    const gap = Number.parseFloat(getComputedStyle(track).gap) || 12;
    const amount = card.getBoundingClientRect().width + gap;
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
  }

  #updateButtons() {
    const { track, prev, next } = this.refs;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const left = track.scrollLeft;

    prev.disabled = left <= 2;
    next.disabled = left >= maxScroll - 2;
  }
}

if (!customElements.get('pairs-with-item')) {
  customElements.define('pairs-with-item', PairsWithItem);
}

if (!customElements.get('pairs-with')) {
  customElements.define('pairs-with', PairsWith);
}
