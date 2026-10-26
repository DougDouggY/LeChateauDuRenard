import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/500.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "./style.css";
import { Simulation } from "./simulation";
import { Renderer } from "./renderer";
import { UI } from "./ui";
import { FLOOR_HEIGHT, insideFort, elevation } from "./map";
import type { Input } from "./types";
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
let game = new Simulation();
const renderer = new Renderer(canvas);
renderer.zoom =
  window.innerWidth < 800 ? 0.63 : window.innerWidth > 1600 ? 0.92 : 0.8;
const input: Input = {
  keys: new Set(),
  pressed: new Set(),
  mouse: { x: innerWidth / 2, y: innerHeight / 2 },
  down: false,
  clicked: false,
  abilityPressed: false,
};
const ui = new UI(
  () => game,
  renderer,
  () => {
    game = new Simulation(game.defenders.map((d) => d.hero));
    game.started = false;
    game.remaining = 25;
    lastShot = 0;
    lastWave = 0;
    input.down = false;
    input.abilityPressed = false;
    input.keys.clear();
  },
);
let audio: AudioContext | null = null,
  sound = false,
  lastShot = 0,
  lastWave = 0,
  lastHurt = 0;
function tone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.035,
) {
  if (!sound || !audio) return;
  const osc = audio.createOscillator(),
    gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(30, frequency * 0.4),
    audio.currentTime + duration,
  );
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}
window.addEventListener("toggle-audio", () => {
  sound = !sound;
  if (sound) {
    audio ??= new AudioContext();
    void audio.resume();
    tone(440, 0.15);
  }
  const b = document.querySelector<HTMLButtonElement>("#sound")!;
  b.textContent = sound ? "♫" : "♪";
  b.title = sound ? "Couper les sons" : "Activer les sons";
  b.setAttribute("aria-label", b.title);
});
window.addEventListener("keydown", (e) => {
  if (
    e.target instanceof HTMLSelectElement ||
    e.target instanceof HTMLInputElement
  )
    return;
  const k = e.key.toLowerCase();
  if (
    [" ", "tab", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)
  )
    e.preventDefault();
  if (!input.keys.has(k)) input.pressed.add(k);
  input.keys.add(k);
  if (e.repeat) return;
  if (k === "escape") {
    if (game.placement) {
      game.placement = null;
      game.notice("Choix d’emplacement annulé. Aucune pièce dépensée.");
    } else ui.togglePause();
  }
  if (k === "m") renderer.toggleOverview();
  if (k === "tab") ui.toggleOrders();
  if (k === "b") ui.toggleShop();
  if (k === "h") ui.toggleHelp();
});
window.addEventListener("keyup", (e) => input.keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  game.cancelCharge();
  input.keys.clear();
  input.pressed.clear();
  input.down = false;
  input.abilityPressed = false;
  if (game.started && game.phase !== "defeat") {
    game.paused = true;
    ui.mode = "";
    ui.drawOverlay();
  }
});
window.addEventListener("mousemove", (e) => {
  input.mouse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("mousedown", (e) => {
  input.mouse = { x: e.clientX, y: e.clientY };
  if (e.button === 2) {
    if (game.placement) game.placement = null;
    else input.abilityPressed = true;
  }
  if (e.button === 0) {
    input.down = true;
    input.clicked = true;
  }
});
window.addEventListener("mouseup", (e) => {
  input.mouse = { x: e.clientX, y: e.clientY };
  if (e.button === 0) input.down = false;
});
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    renderer.zoom = Math.max(
      0.5,
      Math.min(1.35, renderer.zoom - e.deltaY * 0.0005),
    );
  },
  { passive: false },
);
window.addEventListener("resize", () => renderer.resize());
let last = performance.now(),
  accumulator = 0;
let lastRender = -Infinity;
function frame(now: number) {
  const frameMs = now - last;
  if (game.started && !game.paused) renderer.observeFrame(frameMs);
  const delta = Math.min(frameMs / 1000, 0.1);
  last = now;
  accumulator += delta;
  // Fixed simulation clock; the renderer never owns game state.
  const deckAim = renderer.world(input.mouse, FLOOR_HEIGHT);
  const aim = insideFort(deckAim) ? deckAim : renderer.world(input.mouse);
  input.aimRay = renderer.world(input.mouse, elevation(game.player) + 25);
  let consumed = false;
  while (accumulator >= 1 / 60) {
    game.update(1 / 60, input, aim);
    accumulator -= 1 / 60;
    if (!consumed) {
      input.pressed.clear();
      input.clicked = false;
      input.abilityPressed = false;
      consumed = true;
    }
  }
  if (game.projectiles.some((p) => p.team === "ally" && p.id > lastShot)) {
    const q = game.projectiles.filter((p) => p.team === "ally").at(-1)!;
    lastShot = q.id;
    tone(
      q.kind === "bolt" ? 110 : 500,
      q.kind === "bolt" ? 0.18 : 0.07,
      "triangle",
      0.04,
    );
  }
  if (game.wave !== lastWave) {
    lastWave = game.wave;
    tone(180, 0.6, "sawtooth", 0.025);
  }
  if (game.player.hurt > 0 && now - lastHurt > 400) {
    lastHurt = now;
    tone(80, 0.2, "square", 0.015);
  }
  if ((game.started && !game.paused) || now - lastRender > 120) {
    renderer.render(game, delta, aim, input.mouse);
    lastRender = now;
  }
  ui.update(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Read-only by default. Tests opt in explicitly; this API is absent from normal play.
if (new URLSearchParams(location.search).has("test"))
  Object.assign(window, {
    __game: () => game,
    __renderer: renderer,
    __input: input,
  });
