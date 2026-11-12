<script setup>
/*
 * Internal tooltip for the toolbar's icon buttons. Not exported.
 *
 * The trigger already carries its accessible name (aria-label), so the label
 * here is hidden from assistive tech and exists only for sighted users. It
 * opens after the pointer rests for 300ms, or at once on keyboard focus, and
 * closes on pointer leave, blur or Escape. A mouse click that merely focuses
 * the button does not open it.
 */
import { onBeforeUnmount, ref } from 'vue'

defineProps({
  text: { type: String, default: '' },
})

const OPEN_DELAY = 300

const open = ref(false)

let timer

function clearTimer() {
  clearTimeout(timer)
  timer = undefined
}

function close() {
  clearTimer()
  open.value = false
}

function onPointerEnter() {
  clearTimer()

  timer = setTimeout(() => {
    open.value = true
  }, OPEN_DELAY)
}

function onFocusIn(event) {
  let keyboardFocus = false

  try {
    keyboardFocus = Boolean(event.target?.matches?.(':focus-visible'))
  } catch {
    keyboardFocus = false
  }

  if (keyboardFocus) {
    clearTimer()
    open.value = true
  }
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    close()
  }
}

onBeforeUnmount(clearTimer)
</script>

<template>
  <span
    class="relative inline-flex"
    @focusin="onFocusIn"
    @focusout="close"
    @keydown="onKeydown"
    @pointerenter="onPointerEnter"
    @pointerleave="close">
    <slot />

    <span
      :class="[
        'pointer-events-none absolute right-0 top-full z-10 mt-1.5 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white transition-opacity ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:duration-[120ms]',
        open ? 'opacity-100 duration-200' : 'opacity-0 duration-[140ms]',
      ]"
      aria-hidden="true">
      {{ text }}
    </span>
  </span>
</template>
