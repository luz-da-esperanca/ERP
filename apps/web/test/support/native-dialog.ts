import { vi } from 'vitest';

export function installNativeDialogDouble() {
  const prototype = HTMLDialogElement.prototype;
  const previousShow = Object.getOwnPropertyDescriptor(prototype, 'showModal');
  const previousClose = Object.getOwnPropertyDescriptor(prototype, 'close');
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  Object.defineProperty(prototype, 'showModal', {
    configurable: true,
    value: showModal,
  });
  Object.defineProperty(prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
  return {
    showModal,
    restore() {
      for (const [name, descriptor] of [
        ['showModal', previousShow],
        ['close', previousClose],
      ] as const) {
        if (descriptor) Object.defineProperty(prototype, name, descriptor);
        else Reflect.deleteProperty(prototype, name);
      }
    },
  };
}
