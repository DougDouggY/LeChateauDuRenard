import type { Simulation } from "./simulation";
import type { Renderer } from "./renderer";
import { SIDES, distance, type Order, type Side } from "./types";
import { EQUIPMENT } from "./workshop";
import { HEROES, hero } from "./heroes";
import { frontState, priorityFront } from "./fronts";
export const fox = `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M7 8l14 9h6l14-9-3 25-14 10L10 33z" fill="currentColor"/><path d="M12 27l9 3 3 9 3-9 9-3-6 9-6 5-6-5z" fill="#172b35"/><path d="M14 23l6 3m8 0 6-3" stroke="#172b35" stroke-width="3"/></svg>`;
const icons = {
  bow: "➶",
  sword: "⚔",
  ballista: "↠",
  wood: `<svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><ellipse cx="14" cy="14" rx="10" ry="12" fill="#bc9146" stroke="#eed39b" stroke-width="1.5"/><ellipse cx="14" cy="14" rx="6.5" ry="8.5" stroke="#765a2e" stroke-width="1.5"/><path d="M14 7v14m-4-10h6a2 2 0 0 1 0 4h-4a2 2 0 0 0 0 4h6" stroke="#f3d995" stroke-width="1.5"/></svg>`,
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
  mode = "";
  shopSignature = "";
  selectedSlot = 0;
  lastGold = 0;
  squadSignature = "";
  constructor(
    public getGame: () => Simulation,
    public renderer: Renderer,
    public restart: () => void,
  ) {
    this.hud.innerHTML = `<header class="topbar"><div class="brand"><span class="brand-fox">${fox}</span><div>LE CHÂTEAU <span>DU RENARD</span><small>LA DERNIÈRE VEILLE</small></div></div><div class="wave-panel"><div class="wave-top"><span class="live-dot"></span><span id="phase-label">PRÉPARATION</span><span id="wave-count">VEILLE 01</span></div><div class="wave-track"><i id="wave-progress"></i></div><div class="wave-bottom"><span id="wave-description">Les ténèbres approchent</span><span id="wave-timer">10 s</span></div></div><div class="top-actions"><div class="resource"><span>${icons.wood}</span><strong id="wallet">0</strong><small>OR</small></div><button class="icon-btn" id="sound" title="Activer les sons" aria-label="Activer les sons">♪</button><button class="icon-btn" id="help" title="Commandes (H)" aria-label="Afficher les commandes">?</button><button class="icon-btn" id="pause" title="Pause (Échap)" aria-label="Mettre en pause">Ⅱ</button></div></header>
 <aside class="squad-panel"><div class="eyebrow">LA GARDE DU RENARD <span>03</span></div><div id="squad"></div><button id="orders-button" class="text-btn"><span>⚑</span> Ordres aux compagnons <kbd>Tab</kbd></button><div id="orders" class="orders hidden"></div></aside>
 <div class="objective"><span class="objective-mark">✦</span><div class="eyebrow">VOTRE MISSION</div><strong id="objective-title">Tenez jusqu’à l’aube.</strong><p id="objective-text">Défendez les quatre fronts avec votre garde.</p></div>
 <div id="notice" class="notice hidden"></div><div id="assault-alert" class="assault-alert hidden" role="status" aria-live="polite"><span class="assault-emblem">⚑</span><div class="eyebrow" id="assault-wave"></div><strong id="assault-text"></strong><span class="assault-rule"></span></div><div id="context" class="context hidden"></div>
 <footer class="bottom-bar"><div class="chapter"><span class="chapter-line"></span><div><small>LES TERRES OUBLIÉES</small><strong>La nuit des braises</strong><span>Prototype jouable · v0.5</span></div></div><div class="loadout"><div id="weapon2" class="weapon active"><span class="weapon-icon">${icons.bow}</span><span>Arc de garde<small id="ammo">24 flèches</small></span></div><div class="loadout-divider"></div><div id="power-slot" class="power-slot"><kbd>CLIC DROIT</kbd><span id="power-symbol">✹</span><div><b id="power-name">Flèche explosive</b><small id="power-state">Prêt</small></div><i id="power-ready"></i></div><div class="loadout-divider"></div><div class="dodge"><kbd>Shift</kbd><span>Dash</span><i id="dodge-bar"></i></div></div><div class="bottom-tools"><button id="overview-button" aria-pressed="false">Vue d’ensemble <kbd>M</kbd></button><button id="shop-button"><span>⚒</span> Ouvrier <kbd>B</kbd></button><span>Molette · zoom</span></div></footer><div class="key-strip"><span><kbd>ZQSD / WASD</kbd> Se déplacer</span><span><kbd>CLIC G.</kbd> Maintenir / relâcher</span><span><kbd>CLIC D.</kbd> Pouvoir</span><span><kbd>E</kbd> Interagir</span><span><kbd>R</kbd> Recharger / réparer</span></div><section id="drawer" class="drawer hidden"></section>`;
    this.hud
      .querySelector("#overview-button")!
      .addEventListener("click", () => this.renderer.toggleOverview());
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
    window.addEventListener("hero-art-ready", () => {
      if (!this.getGame().started) this.renderIntro();
    });
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
    if (g.paused) g.cancelCharge();
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
      drawer.innerHTML = `<button class="drawer-close" aria-label="Fermer">×</button><div class="eyebrow">LE MANUEL DE LA GARDE</div><h2>Chaque geste compte.</h2><dl><dt>ZQSD / WASD / flèches</dt><dd>Déplacez-vous librement sur la plateforme, entièrement au niveau des remparts.</dd><dt>Souris + clic gauche</dt><dd>Maintenez le clic gauche pour bander l’arc, puis relâchez pour tirer vers la souris. La pleine charge prend 0,95 s : portée de 250 à 1 300, dégâts de 18 à 56 avant améliorations. Aucun tir automatique pendant le maintien.</dd><dt>Clic droit · Pouvoir</dt><dd>Utilise le pouvoir de votre archer : ${hero(this.getGame().player.hero).powerName}. Il consomme des flèches et possède sa propre recharge, affichée en bas. Les alliés utilisent leur pouvoir seuls.</dd><dt>Shift / Espace</dt><dd>Dash dans la direction du déplacement, ou vers la visée à l’arrêt. Recharge de 1,5 s.</dd><dt>E</dt><dd>Remplissez votre carquois près de la réserve centrale. Entre les manches, parlez à Gaspard, l’ouvrier.</dd><dt>B · L’ouvrier</dt><dd>Entre les manches, choisissez une baliste ou une réserve, puis cliquez sur un emplacement éclairé. Gaspard va chercher la commande, l’apporte et l’installe. Échap annule le choix d’emplacement sans dépense.</dd><dt>Baliste achetée</dt><dd>E pour la servir ; clic pour tirer ; R pour recharger (2 pièces) ; F pour la transporter ; E pour la déposer.</dd><dt>Maintenir R à pied</dt><dd>Répare une structure proche en dépensant des pièces.</dd><dt>M · Vue d’ensemble</dt><dd>Affiche le château et les fronts attaqués. M de nouveau pour suivre votre archer.</dd><dt>Tab / H / Échap</dt><dd>Ordres individuels / aide / pause.</dd></dl><p class="drawer-note">Départ : trois arcs, une réserve et aucune baliste. Chaque ennemi vaincu rapporte 10 pièces (20 pour une brute), puis 45 pièces à la fin de la manche. Gaspard arrive par l’escalier central pendant la pause de 60 secondes. Une livraison en cours termine avant le prochain assaut.</p>`;
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
      drawer.innerHTML = `<button class="drawer-close" aria-label="Fermer">×</button><div class="eyebrow">GASPARD · OUVRIER DU CHÂTEAU</div><h2>À votre service.</h2><p class="worker-status">${status}</p><div class="shop-wallet">${Math.floor(g.coins)} <span>pièces disponibles</span></div><div class="eyebrow shop-section">ÉQUIPEMENT À LIVRER</div><div class="upgrade-list equipment-list">${EQUIPMENT.map((u) => `<button data-equipment="${u.id}" ${!canBuy || g.coins < u.cost || !g.availableSites(u.id).length ? "disabled" : ""}><span class="upgrade-icon">${u.id === "ballista" ? "↠" : "➶"}</span><span><strong>${u.name}</strong><small>${u.description}</small><em>${g.availableSites(u.id).length} emplacement(s) libre(s)</em></span><b>${u.cost} pièces</b></button>`).join("")}</div><div class="eyebrow shop-section">AMÉLIORATIONS</div><div class="upgrade-list">${g.upgrades.map((u) => `<button data-upgrade="${u.id}" ${!canBuy || g.coins < u.cost || u.level >= 3 ? "disabled" : ""}><span class="upgrade-icon">${u.id === "walls" ? "⬡" : u.id === "repair" ? "⚒" : "↠"}</span><span><strong>${u.name}</strong><small>${u.description}</small><em>Niveau ${u.level} / 3 · livraison par Gaspard</em></span><b>${u.level >= 3 ? "MAX" : `${u.cost} pièces`}</b></button>`).join("")}</div><button id="next-wave" class="primary small" ${g.phase !== "preparation" || w.busy || g.placement ? "disabled" : ""}>Appeler la prochaine vague <span>→</span></button>`;
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
    const g = this.getGame(),
      selected = g.defenders[this.selectedSlot],
      chosen = hero(selected.hero);
    this.overlay.className = "intro-overlay roster-overlay";
    this.overlay.innerHTML = `<div class="roster-shell"><section class="roster-story"><div class="intro-crest">${fox}</div><div class="eyebrow">LE CHÂTEAU DU RENARD · LA DERNIÈRE VEILLE</div><h1>Choisissez<br>votre garde<span>.</span></h1><p>Huit capuches. Huit façons de tenir la nuit.<br>Choisissez votre archer et vos deux compagnons.</p><div class="chosen-profile"><div class="chosen-portrait" style="--hero-color:${chosen.color}"><img src="${this.renderer.heroPortrait(chosen.id)}" alt="${chosen.name}, archer à capuche ${chosen.colorName}"></div><div><small>CAPUCHE ${chosen.colorName.toUpperCase()}</small><h2>${chosen.name}</h2><p>${chosen.title}</p></div></div><div class="chosen-power" style="--hero-color:${chosen.color}"><span>${chosen.symbol}</span><div><strong>${chosen.powerName}</strong><p>${chosen.description}</p><small>Clic droit · ${chosen.cooldown} s de recharge · ${chosen.ammoCost} flèche${chosen.ammoCost > 1 ? "s" : ""}</small></div></div><button id="start-game" class="primary" ${!this.renderer.ready ? "disabled" : ""}>${this.renderer.assetError ? "Une illustration n’a pas chargé" : this.renderer.ready ? "Prendre la garde" : "Chargement des illustrations…"} <span>→</span></button><div class="intro-details"><span>1 joueur + 2 compagnons autonomes</span><i>✦</i><span>Sans boss</span></div><small class="roster-controls">ZQSD / WASD · Clic gauche : arc · Clic droit : pouvoir</small></section><section class="roster-gallery"><div class="gallery-heading"><div class="eyebrow">COMPOSEZ VOTRE GARDE</div><span>03 / 03</span></div><div class="roster-slots" role="group" aria-label="Membre de la garde à personnaliser">${g.defenders.map((d) => `<button data-roster-slot="${d.id}" aria-label="Personnage ${d.id === 0 ? "J1" : `IA${d.id}`}" aria-pressed="${this.selectedSlot === d.id}" style="--hero-color:${d.color}"><div class="slot-portrait" style="background-image:url('${this.renderer.heroPortrait(d.hero)}')"></div><span><small>${d.id === 0 ? "VOUS · J1" : `COMPAGNON · IA${d.id}`}</small><strong>${d.name}</strong></span><i>${this.selectedSlot === d.id ? "✎" : "✓"}</i></button>`).join("")}</div><div class="roster-grid" role="group" aria-label="Huit archers à capuche">${HEROES.map(
      (h) => {
        const assigned = g.defenders.find((d) => d.hero === h.id);
        return `<button class="hero-card" data-hero="${h.id}" aria-label="${h.name}, capuche ${h.colorName}, ${h.powerName}" aria-pressed="${selected.hero === h.id}" style="--hero-color:${h.color}">${assigned ? `<span class="hero-assigned">${assigned.id === 0 ? "J1" : `IA${assigned.id}`}</span>` : ""}<div class="hero-art"><img src="${this.renderer.heroPortrait(h.id)}" alt=""></div><strong>${h.name}</strong><span class="hero-color">${h.colorName}</span><small>${h.symbol} ${h.powerName}</small></button>`;
      },
    ).join(
      "",
    )}</div><p class="roster-tip">Choisissez d’abord un membre de la garde, puis sa capuche.<br>Chaque archer apporte son propre pouvoir. Tous sont disponibles.</p></section></div>`;
    for (const b of this.overlay.querySelectorAll<HTMLButtonElement>(
      "[data-roster-slot]",
    ))
      b.onclick = () => {
        this.selectedSlot = Number(b.dataset.rosterSlot);
        this.renderIntro();
      };
    for (const b of this.overlay.querySelectorAll<HTMLButtonElement>(
      "[data-hero]",
    ))
      b.onclick = () => {
        g.selectHero(this.selectedSlot, Number(b.dataset.hero));
        this.renderIntro();
      };
    this.overlay.querySelector("#start-game")!.addEventListener("click", () => {
      if (!this.renderer.ready) return;
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
    this.helpOpen = false;
    this.orderOpen = false;
    this.selectedSlot = 0;
    this.drawDrawer();
    this.drawOrders();
    this.renderIntro();
  }
  update(now: number) {
    if (now - this.last < 100) return;
    this.last = now;
    const g = this.getGame(),
      p = g.player;
    this.set("wallet", String(g.coins));
    if (g.coins > this.lastGold)
      this.hud.querySelector("#wallet")?.animate(
        [
          { color: "#fff0bb", transform: "scale(1.18)" },
          { color: "#edddbc", transform: "scale(1)" },
        ],
        { duration: 450 },
      );
    this.lastGold = g.coins;
    const ability = hero(p.hero),
      slot = this.hud.querySelector<HTMLElement>("#power-slot")!;
    this.set("power-name", ability.powerName);
    this.set("power-symbol", ability.symbol);
    this.set(
      "power-state",
      p.mounted !== null
        ? "Quittez la baliste"
        : p.carried !== null
          ? "Déposez la baliste"
          : p.ammo < ability.ammoCost
            ? "Carquois vide"
            : p.abilityCooldown > 0
              ? `${Math.ceil(p.abilityCooldown)} s`
              : `Prêt · ${ability.ammoCost} flèche${ability.ammoCost > 1 ? "s" : ""}`,
    );
    slot.style.setProperty("--hero-color", ability.color);
    slot.classList.toggle(
      "cooling",
      p.abilityCooldown > 0 ||
        p.ammo < ability.ammoCost ||
        p.mounted !== null ||
        p.carried !== null,
    );
    (this.hud.querySelector("#power-ready") as HTMLElement).style.width =
      `${100 * (1 - p.abilityCooldown / ability.cooldown)}%`;
    const alert = this.hud.querySelector("#assault-alert")!;
    alert.classList.toggle("hidden", !g.started || !g.waveAlert || g.paused);
    if (g.waveAlert) {
      this.set(
        "assault-wave",
        `VAGUE ${String(g.wave).padStart(2, "0")} · ALERTE AUX REMPARTS`,
      );
      this.set("assault-text", g.waveAlert.text);
      (alert as HTMLElement).style.opacity = String(
        Math.min(1, g.waveAlert.life / 0.45),
      );
    }
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
    const squadKey =
      this.getGame()
        .defenders.map((d) =>
          [
            d.hero,
            d.hp,
            d.ammo,
            d.mounted,
            d.carried,
            d.order,
            d.side,
            Math.ceil(d.dead),
          ].join(","),
        )
        .join("|") + this.renderer.walkAtlasReady;
    if (squadKey !== this.squadSignature) {
      this.squadSignature = squadKey;
      const squad = this.hud.querySelector("#squad")!;
      squad.innerHTML = g.defenders
        .map(
          (d) =>
            `<div class="defender ${d.id === 0 ? "human" : ""} ${d.dead > 0 ? "fallen" : ""}"><div class="portrait hero-portrait" style="border-color:${d.color};background-image:url('${this.renderer.heroPortrait(d.hero)}')"><span>${d.id === 0 ? "J1" : "IA"}</span></div><div class="defender-info"><div><strong>${d.name}</strong><span>${d.id === 0 ? "VOUS" : SIDES[d.side].toUpperCase()}</span></div><div class="health"><i style="width:${(d.hp / d.maxHp) * 100}%;background:${d.color}"></i></div><small>${d.dead > 0 ? `À terre · ${Math.ceil(d.dead)} s` : d.mounted !== null ? "Sert une baliste" : d.carried !== null ? "Déplace une baliste" : d.id === 0 ? `${d.ammo} flèches · Archer` : { auto: "Défense autonome", follow: "Vous suit", defend: "Défend le front", repair: "Répare les défenses", ballista: "Sert une baliste" }[d.order]}</small></div></div>`,
        )
        .join("");
    }
    const frontInfo = frontState(g),
      focus = priorityFront(g, frontInfo);
    this.hud
      .querySelector("#overview-button")!
      .setAttribute("aria-pressed", String(this.renderer.overview));
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
          "<kbd>R</kbd> Maintenir pour réparer <span>·</span> Consomme des pièces";
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
    const signature = `${g.phase}:${g.workshop.state}:${g.workshop.job?.kind}:${Math.floor(g.coins)}:${g.ballistas.length}:${g.stocks.length}:${g.upgrades.map((u) => u.level).join()}`;
    if (this.shopOpen && signature !== this.shopSignature) {
      this.shopSignature = signature;
      this.drawDrawer();
    }
    this.set(
      "objective-title",
      focus
        ? `Défendez le ${SIDES[focus.side].toLowerCase()}.`
        : g.phase === "preparation" && g.wave > 0
          ? "L’ouvrier vous attend."
          : "Préparez le front nord.",
    );
    this.set(
      "objective-text",
      focus
        ? `${focus.enemies || "Des"} ennemis ${focus.enemies ? "sur ce front." : "en approche."} Suivez la zone éclairée.${focus.breaches ? " Brèche à réparer !" : ""} M : vue d’ensemble.`
        : g.phase === "preparation" && g.wave > 0
          ? "Gaspard vous attend à l’accès central. E ou B pour commander."
          : "Les ennemis viendront du nord. Placez-vous près du rempart éclairé.",
    );
    this.drawOverlay();
  }
}
const clampPercent = (v: number) => Math.max(0, Math.min(100, v * 100));
