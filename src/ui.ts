import type { Simulation } from "./simulation";
import type { Renderer } from "./renderer";
import { SIDES, distance, type Order, type Side } from "./types";
import { EQUIPMENT } from "./workshop";
export const fox = `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M7 8l14 9h6l14-9-3 25-14 10L10 33z" fill="currentColor"/><path d="M12 27l9 3 3 9 3-9 9-3-6 9-6 5-6-5z" fill="#172b35"/><path d="M14 23l6 3m8 0 6-3" stroke="#172b35" stroke-width="3"/></svg>`;
const icons = {
  bow: "➶",
  sword: "⚔",
  ballista: "↠",
  wood: "✦",
  repair: "⚒",
  shield: "⬡",
};
export class UI {
  hud = document.querySelector<HTMLDivElement>("#hud")!;
  overlay = document.querySelector<HTMLDivElement>("#overlay")!;
  last = 0;
  orderOpen = false;
  shopOpen = false;
  helpOpen = false;
  mini!: HTMLCanvasElement;
  mode = "";
  shopSignature = "";
  constructor(
    public getGame: () => Simulation,
    public renderer: Renderer,
    public restart: () => void,
  ) {
    this.hud.innerHTML = `<header class="topbar"><div class="brand"><span class="brand-fox">${fox}</span><div>LE CHÂTEAU <span>DU RENARD</span><small>LA DERNIÈRE VEILLE</small></div></div><div class="wave-panel"><div class="wave-top"><span class="live-dot"></span><span id="phase-label">PRÉPARATION</span><span id="wave-count">VEILLE 01</span></div><div class="wave-track"><i id="wave-progress"></i></div><div class="wave-bottom"><span id="wave-description">Les ténèbres approchent</span><span id="wave-timer">10 s</span></div></div><div class="top-actions"><div class="resource"><span>${icons.wood}</span><strong id="wood">0</strong><small>POINTS</small></div><button class="icon-btn" id="sound" title="Activer les sons" aria-label="Activer les sons">♪</button><button class="icon-btn" id="help" title="Commandes (H)" aria-label="Afficher les commandes">?</button><button class="icon-btn" id="pause" title="Pause (Échap)" aria-label="Mettre en pause">Ⅱ</button></div></header>
 <aside class="squad-panel"><div class="eyebrow">LA GARDE DU RENARD <span>03</span></div><div id="squad"></div><button id="orders-button" class="text-btn"><span>⚑</span> Ordres aux compagnons <kbd>Tab</kbd></button><div id="orders" class="orders hidden"></div></aside>
 <aside class="map-panel"><div class="map-title"><span class="eyebrow">LES QUATRE FRONTS</span><span class="map-compass">N ↑</span></div><div class="map-wrap"><canvas id="minimap" width="240" height="190" aria-label="Mini-carte des défenseurs et des ennemis"></canvas><span class="map-corner tl"></span><span class="map-corner br"></span></div><div id="fronts" class="fronts"></div><div class="map-legend"><span><i class="dot gold"></i>Vous</span><span><i class="dot green"></i>Alliés</span><span><i class="dot red"></i>Ennemis</span></div></aside>
 <section class="fort-status"><div class="eyebrow"><span>INTÉGRITÉ DU CHÂTEAU</span><strong id="integrity">100 %</strong></div><div class="fort-track"><i id="integrity-bar"></i></div><div id="fort-detail">Les remparts tiennent bon.</div></section>
 <div class="objective"><span class="objective-mark">✦</span><div class="eyebrow">VOTRE MISSION</div><strong id="objective-title">Tenez jusqu’à l’aube.</strong><p id="objective-text">Défendez les quatre fronts avec votre garde.</p></div>
 <div id="notice" class="notice hidden"></div><div id="context" class="context hidden"></div>
 <footer class="bottom-bar"><div class="chapter"><span class="chapter-line"></span><div><small>LES TERRES OUBLIÉES</small><strong>La nuit des braises</strong><span>Prototype jouable · v0.2</span></div></div><div class="loadout"><div id="weapon2" class="weapon active"><span class="weapon-icon">${icons.bow}</span><span>Arc de garde<small id="ammo">24 flèches</small></span></div><div class="ammo-tip"><kbd>E</kbd><span>Près d’une réserve<br>Remplir le carquois</span></div><div class="loadout-divider"></div><div class="dodge"><kbd>Espace</kbd><span>Esquive</span><i id="dodge-bar"></i></div></div><div class="bottom-tools"><button id="shop-button"><span>⚒</span> Ouvrier <kbd>B</kbd></button><span>Molette · zoom</span></div></footer><div class="key-strip"><span><kbd>ZQSD / WASD</kbd> Se déplacer</span><span><kbd>CLIC</kbd> Attaquer</span><span><kbd>E</kbd> Interagir</span><span><kbd>R</kbd> Recharger / réparer</span></div><section id="drawer" class="drawer hidden"></section>`;
    this.mini = this.hud.querySelector("#minimap")!;
    this.hud
      .querySelector("#pause")!
      .addEventListener("click", () => this.togglePause());
    this.hud
      .querySelector("#help")!
      .addEventListener("click", () => this.toggleHelp());
    this.hud
      .querySelector("#orders-button")!
      .addEventListener("click", () => this.toggleOrders());
    this.hud
      .querySelector("#shop-button")!
      .addEventListener("click", () => this.toggleShop());
    this.hud
      .querySelector("#sound")!
      .addEventListener("click", () =>
        window.dispatchEvent(new Event("toggle-audio")),
      );
    this.renderIntro();
  }
  set(id: string, text: string) {
    const e = this.hud.querySelector(`#${id}`);
    if (e && e.textContent !== text) e.textContent = text;
  }
  togglePause() {
    const g = this.getGame();
    if (!g.started || g.phase === "defeat") return;
    g.paused = !g.paused;
    this.mode = "";
    this.drawOverlay();
  }
  toggleHelp() {
    this.helpOpen = !this.helpOpen;
    this.shopOpen = false;
    this.drawDrawer();
  }
  toggleShop() {
    this.shopOpen = !this.shopOpen;
    this.helpOpen = false;
    this.drawDrawer();
  }
  toggleOrders() {
    this.orderOpen = !this.orderOpen;
    this.drawOrders();
  }
  drawOrders() {
    const panel = this.hud.querySelector("#orders")!;
    panel.classList.toggle("hidden", !this.orderOpen);
    if (!this.orderOpen) return;
    panel.innerHTML =
      `<p>Chaque allié reçoit son propre ordre.</p>` +
      this.getGame()
        .defenders.slice(1)
        .map(
          (d) =>
            `<label>${d.name}<select aria-label="Ordre pour ${d.name}" data-actor="${d.id}"><option value="auto">Autonome</option><option value="follow">Me suivre</option><option value="defend">Défendre un front</option><option value="repair">Réparer</option><option value="ballista">Servir une baliste</option></select><select aria-label="Front pour ${d.name}" data-side="${d.id}">${SIDES.map((s, i) => `<option value="${i}">${s}</option>`).join("")}</select></label>`,
        )
        .join("");
    for (const d of this.getGame().defenders.slice(1)) {
      const select = panel.querySelector<HTMLSelectElement>(
        `[data-actor="${d.id}"]`,
      )!;
      select.value = d.order;
      select.onchange = () => {
        this.getGame().release(d);
        d.order = select.value as Order;
        d.path = [];
      };
      const side = panel.querySelector<HTMLSelectElement>(
        `[data-side="${d.id}"]`,
      )!;
      side.value = String(d.side);
      side.onchange = () => {
        this.getGame().release(d);
        d.side = Number(side.value) as Side;
        d.order = "defend";
        select.value = "defend";
        d.path = [];
      };
    }
  }
  drawDrawer() {
    const drawer = this.hud.querySelector("#drawer")!;
    drawer.classList.toggle("hidden", !this.shopOpen && !this.helpOpen);
    if (this.helpOpen) {
      drawer.innerHTML = `<button class="drawer-close" aria-label="Fermer">×</button><div class="eyebrow">LE MANUEL DE LA GARDE</div><h2>Chaque geste compte.</h2><dl><dt>ZQSD / WASD / flèches</dt><dd>Déplacez-vous librement sur la plateforme, entièrement au niveau des remparts.</dd><dt>Souris + clic gauche</dt><dd>Visez et tirez à l’arc. Vos trois défenseurs sont des archers.</dd><dt>Espace</dt><dd>Esquive rapide et courte invulnérabilité.</dd><dt>E</dt><dd>Remplissez votre carquois près de la réserve centrale. Entre les manches, parlez à Gaspard, l’ouvrier.</dd><dt>B · L’ouvrier</dt><dd>Entre les manches, choisissez une baliste ou une réserve, puis cliquez sur un emplacement éclairé. Gaspard va chercher la commande, l’apporte et l’installe. Échap annule le choix d’emplacement sans dépense.</dd><dt>Baliste achetée</dt><dd>E pour la servir ; clic pour tirer ; R pour recharger (2 points) ; F pour la transporter ; E pour la déposer.</dd><dt>Maintenir R à pied</dt><dd>Répare une structure proche en dépensant des points.</dd><dt>Tab / H / Échap</dt><dd>Ordres individuels / aide / pause.</dd></dl><p class="drawer-note">Départ : trois arcs, une réserve et aucune baliste. Chaque ennemi vaincu rapporte 10 points (20 pour une brute), puis 45 points à la fin de la manche. Gaspard arrive par l’escalier central pendant la pause de 60 secondes. Une livraison en cours termine avant le prochain assaut.</p>`;
    } else if (this.shopOpen) {
      const g = this.getGame(),
        w = g.workshop,
        canBuy = w.ready;
      const status = w.job
        ? `Gaspard ${w.state === "fetching" ? "va chercher" : w.state === "building" ? "installe" : "apporte"} votre commande. Patientez avant le prochain achat.`
        : canBuy
          ? "« Dites-moi de quoi vous avez besoin, je vous prépare ça rapidement ! »"
          : g.wave === 0
            ? "Gaspard montera par l’escalier central après la première manche. Pour le moment : vos arcs et la réserve centrale."
            : "L’ouvrier revient entre les manches.";
      drawer.innerHTML = `<button class="drawer-close" aria-label="Fermer">×</button><div class="eyebrow">GASPARD · OUVRIER DU CHÂTEAU</div><h2>À votre service.</h2><p class="worker-status">${status}</p><div class="shop-points">${Math.floor(g.resources)} <span>points disponibles</span></div><div class="eyebrow shop-section">ÉQUIPEMENT À LIVRER</div><div class="upgrade-list equipment-list">${EQUIPMENT.map((u) => `<button data-equipment="${u.id}" ${!canBuy || g.resources < u.cost || !g.availableSites(u.id).length ? "disabled" : ""}><span class="upgrade-icon">${u.id === "ballista" ? "↠" : "➶"}</span><span><strong>${u.name}</strong><small>${u.description}</small><em>${g.availableSites(u.id).length} emplacement(s) libre(s)</em></span><b>${u.cost} pts</b></button>`).join("")}</div><div class="eyebrow shop-section">AMÉLIORATIONS</div><div class="upgrade-list">${g.upgrades.map((u) => `<button data-upgrade="${u.id}" ${!canBuy || g.resources < u.cost || u.level >= 3 ? "disabled" : ""}><span class="upgrade-icon">${u.id === "walls" ? "⬡" : u.id === "repair" ? "⚒" : "↠"}</span><span><strong>${u.name}</strong><small>${u.description}</small><em>Niveau ${u.level} / 3 · livraison par Gaspard</em></span><b>${u.level >= 3 ? "MAX" : `${u.cost} pts`}</b></button>`).join("")}</div><button id="next-wave" class="primary small" ${g.phase !== "preparation" || w.busy || g.placement ? "disabled" : ""}>Appeler la prochaine vague <span>→</span></button>`;
      for (const button of drawer.querySelectorAll<HTMLButtonElement>(
        "[data-equipment]",
      ))
        button.onclick = () => {
          if (
            g.requestPlacement(button.dataset.equipment as "ballista" | "stock")
          ) {
            this.shopOpen = false;
            this.drawDrawer();
          }
        };
      for (const button of drawer.querySelectorAll<HTMLButtonElement>(
        "[data-upgrade]",
      ))
        button.onclick = () => {
          g.buy(button.dataset.upgrade!);
          this.drawDrawer();
        };
      drawer.querySelector<HTMLButtonElement>("#next-wave")!.onclick = () => {
        g.startWave();
        this.shopOpen = false;
        this.drawDrawer();
      };
    }
    drawer
      .querySelector<HTMLButtonElement>(".drawer-close")
      ?.addEventListener("click", () => {
        this.shopOpen = false;
        this.helpOpen = false;
        this.drawDrawer();
      });
  }
  renderIntro() {
    this.overlay.className = "intro-overlay";
    this.overlay.innerHTML = `<div class="intro-card"><div class="intro-crest">${fox}</div><div class="eyebrow">UN CHÂTEAU. TROIS DÉFENSEURS. UNE DERNIÈRE VEILLE.</div><h1>La nuit<br>nous appartient<span>.</span></h1><p>Au-delà des remparts, les ombres se rassemblent.<br>Trois archers. Une réserve. Vos remparts.<br>Le Château du Renard ne tombera pas ce soir.</p><button id="start-game" class="primary">Prendre la garde <span>→</span></button><div class="intro-details"><span>1 archer + 2 compagnons IA</span><i>✦</i><span>Défense coopérative</span></div><small class="intro-footnote">Prototype vertical · Univers médiéval fantastique<br>Déplacement ZQSD / WASD · Souris pour viser</small></div><div class="intro-caption"><span class="live-dot"></span> LE CHÂTEAU DU RENARD <span>RÉGION DES MARCHES DU NORD</span></div>`;
    this.overlay.querySelector("#start-game")!.addEventListener("click", () => {
      const g = this.getGame();
      g.started = true;
      g.remaining = 25;
      this.overlay.className = "hidden";
      this.overlay.innerHTML = "";
      window.dispatchEvent(new Event("game-start"));
    });
  }
  drawOverlay() {
    const g = this.getGame(),
      mode = g.phase === "defeat" ? "defeat" : g.paused ? "pause" : "";
    if (this.mode === mode) return;
    this.mode = mode;
    if (!mode) {
      if (g.started) {
        this.overlay.className = "hidden";
        this.overlay.innerHTML = "";
      }
      return;
    }
    this.overlay.className = "modal-overlay";
    this.overlay.innerHTML = `<div class="modal-card"><div class="intro-crest">${fox}</div><div class="eyebrow">${mode === "defeat" ? "LA GARDE A TENU BON" : "UN INSTANT DE RÉPIT"}</div><h1>${mode === "defeat" ? "Les braises s’éteignent." : "La veille attend."}</h1><p>${mode === "defeat" ? `Vague ${g.wave} · ${g.kills} ennemis vaincus.<br>Le renard reviendra défendre ses terres.` : "Votre garde reprendra à votre signal."}</p><button id="resume" class="primary">${mode === "defeat" ? "Reprendre la garde" : "Continuer la veille"} <span>→</span></button>${mode !== "defeat" ? '<button id="restart" class="text-btn">Recommencer une partie</button>' : ""}</div>`;
    this.overlay.querySelector("#resume")!.addEventListener("click", () => {
      if (mode === "defeat") this.reset();
      else {
        g.paused = false;
        this.drawOverlay();
      }
    });
    this.overlay
      .querySelector("#restart")
      ?.addEventListener("click", () => this.reset());
  }
  reset() {
    this.restart();
    this.mode = "";
    this.overlay.className = "hidden";
    this.overlay.innerHTML = "";
    this.shopOpen = false;
    this.orderOpen = false;
    this.drawDrawer();
    this.drawOrders();
  }
  update(now: number) {
    if (now - this.last < 100) return;
    this.last = now;
    const g = this.getGame(),
      p = g.player;
    this.set("wood", String(Math.floor(g.resources)));
    this.set(
      "wave-count",
      `VAGUE ${String(Math.max(1, g.wave)).padStart(2, "0")}`,
    );
    this.set(
      "phase-label",
      g.phase === "preparation"
        ? "PRÉPARATION"
        : g.phase === "defeat"
          ? "CHÂTEAU PERDU"
          : "L’ASSAUT",
    );
    this.set(
      "wave-description",
      g.phase === "preparation"
        ? "Le calme avant la tempête"
        : `${g.enemies.filter((e) => e.hp > 0).length} ennemis aux portes`,
    );
    this.set(
      "wave-timer",
      g.phase === "preparation"
        ? `${Math.max(0, Math.ceil(g.remaining))} s`
        : `${g.kills} vaincus`,
    );
    (this.hud.querySelector("#wave-progress") as HTMLElement).style.width =
      (g.phase === "preparation"
        ? clampPercent(g.remaining / (g.wave === 0 ? 25 : 60))
        : clampPercent(1 - g.spawnLeft / (9 + g.wave * 4))) + "%";
    this.set("integrity", `${Math.round(g.integrity * 100)} %`);
    (this.hud.querySelector("#integrity-bar") as HTMLElement).style.width =
      `${g.integrity * 100}%`;
    const breaches = g.walls.filter((w) => w.hp <= 0).length;
    this.set(
      "fort-detail",
      breaches
        ? `${breaches} brèche${breaches > 1 ? "s" : ""} ! Maintenez R pour réparer.`
        : g.integrity < 0.7
          ? "Les défenses ont besoin de réparations."
          : "Les remparts tiennent bon.",
    );
    const squad = this.hud.querySelector("#squad")!;
    squad.innerHTML = g.defenders
      .map(
        (d) =>
          `<div class="defender ${d.id === 0 ? "human" : ""} ${d.dead > 0 ? "fallen" : ""}"><div class="portrait portrait-${d.id}"><img src="${import.meta.env.BASE_URL}assets/archers-walk.png" alt=""><span>${d.id === 0 ? "J1" : "IA"}</span></div><div class="defender-info"><div><strong>${d.name}</strong><span>${d.id === 0 ? "VOUS" : SIDES[d.side].toUpperCase()}</span></div><div class="health"><i style="width:${(d.hp / d.maxHp) * 100}%;background:${d.color}"></i></div><small>${d.dead > 0 ? `À terre · ${Math.ceil(d.dead)} s` : d.mounted !== null ? "Sert une baliste" : d.carried !== null ? "Déplace une baliste" : d.id === 0 ? `${d.ammo} flèches · Archer` : { auto: "Défense autonome", follow: "Vous suit", defend: "Défend le front", repair: "Répare les défenses", ballista: "Sert une baliste" }[d.order]}</small></div></div>`,
      )
      .join("");
    this.hud.querySelector("#fronts")!.innerHTML = SIDES.map((s, i) => {
      const n = g.enemies.filter((e) => e.hp > 0 && e.side === i).length;
      return `<span class="${n ? "attacked" : ""}"><i></i>${s}<b>${n || "—"}</b></span>`;
    }).join("");
    this.renderer.drawMinimap(this.mini, g);
    this.set("ammo", `${p.ammo} / 24 flèches`);
    (this.hud.querySelector("#dodge-bar") as HTMLElement).style.width =
      `${(1 - p.dodgeCooldown / 1.5) * 100}%`;
    const notice = this.hud.querySelector("#notice")!;
    notice.textContent = g.message;
    notice.classList.toggle("hidden", g.messageTime <= 0 || !g.started);
    let context = "";
    if (g.started && p.dead <= 0) {
      if (g.placement)
        context =
          "<kbd>CLIC</kbd> Choisir un emplacement éclairé <span>·</span> <kbd>Échap</kbd> Annuler sans dépenser";
      else if (g.workshop.ready && distance(p, g.workshop) < 105)
        context = "<kbd>E</kbd> Parler à Gaspard · Acheter et faire livrer";
      else if (p.mounted !== null) {
        const b = g.ballistas[p.mounted];
        context = `<kbd>CLIC</kbd> ${b.loaded ? "Tirer" : b.reload > 0 ? `Rechargement ${b.reload.toFixed(1)} s` : "Non chargée"} <span>·</span> <kbd>R</kbd> Recharger <span>·</span> <kbd>F</kbd> Déplacer <span>·</span> <kbd>E</kbd> Quitter`;
      } else if (p.carried !== null)
        context =
          "<kbd>E</kbd> Déposer la baliste <span>·</span> Plateforme de défense au même niveau";
      else if (g.stocks.some((s) => distance(s, p) < 90))
        context = "<kbd>E</kbd> Remplir le carquois";
      else if (
        g.ballistas.some(
          (b) =>
            b.hp > 0 &&
            b.user === null &&
            b.carrier === null &&
            distance(b, p) < 85,
        )
      )
        context = "<kbd>E</kbd> Servir la baliste";
      else if (
        [...g.walls, ...g.ballistas].some(
          (w) => w.hp < w.maxHp && distance(w, p) < 105,
        )
      )
        context =
          "<kbd>R</kbd> Maintenir pour réparer <span>·</span> Consomme des points";
    }
    const ctx = this.hud.querySelector("#context")!;
    ctx.innerHTML = context;
    ctx.classList.toggle("hidden", !context);
    if (g.shopRequested) {
      g.shopRequested = false;
      this.shopOpen = true;
      this.helpOpen = false;
      this.drawDrawer();
    }
    const signature = `${g.phase}:${g.workshop.state}:${g.workshop.job?.kind}:${Math.floor(g.resources)}:${g.ballistas.length}:${g.stocks.length}:${g.upgrades.map((u) => u.level).join()}`;
    if (this.shopOpen && signature !== this.shopSignature) {
      this.shopSignature = signature;
      this.drawDrawer();
    }
    this.set(
      "objective-title",
      g.phase === "preparation" && g.wave > 0
        ? "L’ouvrier vous attend."
        : "Tenez jusqu’à l’aube.",
    );
    this.set(
      "objective-text",
      g.phase === "preparation" && g.wave > 0
        ? "Retrouvez Gaspard à l’escalier central. E ou B pour commander."
        : "Trois archers, une réserve. Gagnez des points pour équiper la garde.",
    );
    this.drawOverlay();
  }
}
const clampPercent = (v: number) => Math.max(0, Math.min(100, v * 100));
