
"use strict";

// ========================================
// 干支並べ STEP 2
// ========================================

const ZODIACS = [
  "子", "丑", "寅", "卯",
  "辰", "巳", "午", "未",
  "申", "酉", "戌", "亥"
];

const COLORS = ["赤", "青", "黄", "緑"];

const COLOR_CLASSES = {
  "赤": "color-red",
  "青": "color-blue",
  "黄": "color-yellow",
  "緑": "color-green",
  "黒": "color-black"
};

let playerCount = 4;
let players = [];
let field = {};
let catPile = [];

let currentPlayerIndex = 0;
let firstTurn = true;
let gameOver = false;
let phase = "play";

let selectedCardId = null;
let handSort = "zodiac";
let cpuSpeed = "normal";
let cpuColorPredictions = {};


/* ========================================
   CPU担当色推理システム（上級）
======================================== */

// CPUごとの担当色推理データ
let cpuColorBeliefs = {};

// 推理の初期評価点
const CPU_COLOR_BASE_SCORE = 100;

// 推理に使う色
function getCpuInferenceColors() {

  return playerCount === 2
    ? COLORS.slice(0, 3)
    : COLORS.slice();

}


// ========================================
// CPU推理データの初期化
// ========================================

function initializeCpuColorBeliefs() {

  cpuColorBeliefs = {};

  const colors = getCpuInferenceColors();

  // CPUごとに別々の推理データを作成
  players.forEach(cpu => {

    if (cpu.id === 0) {
      return;
    }

    cpuColorBeliefs[cpu.id] = {};

    players.forEach(target => {

      // 自分自身は推理しない
      if (target.id === cpu.id) {
        return;
      }

      const scores = {};

      colors.forEach(color => {

        // 自分の担当色は他人に割り当てられない
        scores[color] =
          color === cpu.color
            ? 0
            : CPU_COLOR_BASE_SCORE;

      });

      cpuColorBeliefs[cpu.id][target.id] = {
        scores: scores,
        observations: 0
      };

    });

  });

}


/* ========================================
   CPU担当色推理：場に出したカードを観察
======================================== */

function observeCpuPlayedCard(
  player,
  card,
  previousPile
) {

  // 猫は担当色の推理に使わない
  if (card.zodiac === "猫") {
    return;
  }

  const previousCount = previousPile.length;

  const previousTop =
    previousCount > 0
      ? previousPile[previousCount - 1]
      : null;

  // 出された色の評価
  let colorBonus = 5;

  // 別の色を上書きした場合
  if (
    previousTop &&
    previousTop.color !== card.color
  ) {
    colorBonus += 15;
  }

  // 同じ干支の山の3枚目
  if (previousCount === 2) {
    colorBonus += 20;
  }

  // 同じ干支の山の4枚目
  if (previousCount === 3) {
    colorBonus += 100;
  }

  // 各CPUがそれぞれ独立して観察する
  players.forEach(cpu => {

    if (cpu.id === 0) {
      return;
    }

    // 自分の行動は相手の推理に使わない
    if (cpu.id === player.id) {
      return;
    }

    const belief =
      cpuColorBeliefs[cpu.id]?.[player.id];

    if (!belief) {
      return;
    }

    // CPU自身の担当色は候補から除外
    if (card.color !== cpu.color) {

      belief.scores[card.color] +=
        colorBonus;

    }

    // 以前の山の一番上が別の色だった場合
    if (
      previousTop &&
      previousTop.color !== card.color &&
      previousTop.color !== cpu.color
    ) {

      belief.scores[previousTop.color] =
        Math.max(
          1,
          belief.scores[previousTop.color] - 30
        );

    }

    belief.observations++;

  });

}


// ========================================
// CPUから見た担当色の予想を取得
// ========================================

function getCpuPredictedColor(
  cpuId,
  targetId
) {

  const belief =
    cpuColorBeliefs[cpuId]?.[targetId];

  if (!belief) {
    return null;
  }

  const colors = getCpuInferenceColors();

  const candidates = colors
    .filter(color => belief.scores[color] > 0)
    .map(color => ({
      color,
      score: belief.scores[color]
    }));

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort(
    (a, b) => b.score - a.score
  );

  return candidates[0].color;

}


/* ========================================
   CPU担当色の推理確率
======================================== */


/* ========================================
   CPU担当色推理（上級）
   全員の担当色の組み合わせを考慮
======================================== */

function getCpuColorProbabilities(
  cpuId,
  targetId
) {

  const cpu = players.find(
    player => player.id === cpuId
  );

  if (!cpu || cpuId === targetId) {
    return {};
  }

  const beliefs = cpuColorBeliefs[cpuId];

  if (!beliefs || !beliefs[targetId]) {
    return {};
  }

  const colors = getCpuInferenceColors();

  // 自分の担当色は他人に割り当てない
  const availableColors = colors.filter(
    color => color !== cpu.color
  );

  const targets = players.filter(
    player => player.id !== cpuId
  );

  // =====================================
  // 観察情報を確率計算用の重みに変換
  // =====================================

  const weights = {};

  targets.forEach(target => {

    const belief = beliefs[target.id];

    const scores = belief.scores;

    const observations =
      belief.observations || 0;

    // 観察が少ない間は推理を弱める
    const confidence = Math.min(
      1,
      observations / 6
    );

    // 上級CPUの推理感度
    const sensitivity =
      0.35 + confidence * 0.65;

    const maxScore = Math.max(
      ...availableColors.map(
        color => scores[color] || 0
      )
    );

    weights[target.id] = {};

    availableColors.forEach(color => {

      const score =
        scores[color] || 0;

      // 指数変換で評価差を反映
      // 最大評価を基準にして数値を安定化
      const exponent =
        ((score - maxScore) / 55) *
        sensitivity;

      weights[target.id][color] =
        Math.exp(exponent);

    });

  });

  // =====================================
  // 担当色の全組み合わせを評価
  // =====================================

  const totals = {};

  targets.forEach(target => {

    totals[target.id] = {};

    availableColors.forEach(color => {
      totals[target.id][color] = 0;
    });

  });

  let totalWeight = 0;

  function exploreAssignments(
    index,
    usedColors,
    assignment,
    weight
  ) {

    if (index >= targets.length) {

      totalWeight += weight;

      targets.forEach(target => {

        const color = assignment[target.id];

        totals[target.id][color] +=
          weight;

      });

      return;
    }

    const target = targets[index];

    availableColors.forEach(color => {

      // 同じ色は2人に割り当てない
      if (usedColors.has(color)) {
        return;
      }

      const nextWeight =
        weight *
        weights[target.id][color];

      usedColors.add(color);

      assignment[target.id] = color;

      exploreAssignments(
        index + 1,
        usedColors,
        assignment,
        nextWeight
      );

      usedColors.delete(color);

      delete assignment[target.id];

    });

  }

  exploreAssignments(
    0,
    new Set(),
    {},
    1
  );

  // =====================================
  // 対象プレイヤーの推理確率を返す
  // =====================================

  const probabilities = {};

  colors.forEach(color => {

    probabilities[color] = 0;

  });

  if (totalWeight > 0) {

    availableColors.forEach(color => {

      probabilities[color] =
        totals[targetId][color] /
        totalWeight;

    });

  }

  return probabilities;

}



// ========================================
// 相手の予想得点を計算
// ========================================

function getCpuExpectedOpponentScore(
  cpu,
  opponent,
  scores
) {

  const probabilities =
    getCpuColorProbabilities(
      cpu.id,
      opponent.id
    );

  let expectedScore = 0;

  getCpuInferenceColors().forEach(color => {

    expectedScore +=
      (scores[color] || 0) *
      (probabilities[color] || 0);

  });

  return expectedScore;
}


// ========================================
// ゲーム終了時の勝敗を推定
// ========================================


/* ========================================
   CPUのゲーム終了時の勝率予測
   担当色の推理＋干支順の同点判定
======================================== */

function evaluateCpuEnding(
  cpu,
  targetField
) {

  const scores = getFieldScores(targetField);

  const colors = getCpuInferenceColors();

  const availableColors = colors.filter(
    color => color !== cpu.color
  );

  const opponents = players.filter(
    player => player.id !== cpu.id
  );

  const beliefs =
    cpuColorBeliefs[cpu.id] || {};

  let totalWeight = 0;
  let winningWeight = 0;


  // =====================================
  // 担当色の組み合わせを評価
  // =====================================

  function evaluateAssignment(
    assignment,
    weight
  ) {

    totalWeight += weight;

    const assignedColors = {
      [cpu.id]: cpu.color,
      ...assignment
    };

    // 担当者がいる色だけで最高得点を求める
    const maxScore = Math.max(
      ...Object.values(assignedColors).map(
        color => scores[color] || 0
      )
    );

    const tiedIds = Object.keys(
      assignedColors
    ).filter(id => {

      const color = assignedColors[id];

      return scores[color] === maxScore;

    });

    let winnerId = null;

    if (tiedIds.length === 1) {

      winnerId = Number(tiedIds[0]);

    } else {

      // ===================================
      // 同点時は子→亥の順番で判定
      // ===================================

      for (const zodiac of ZODIACS) {

        const pile = targetField[zodiac];

        if (!pile || pile.length === 0) {
          continue;
        }

        const top = pile[pile.length - 1];

        const matchedId = tiedIds.find(
          id =>
            assignedColors[id] === top.color
        );

        if (matchedId !== undefined) {

          winnerId = Number(matchedId);
          break;

        }

      }

    }

    // CPU自身が勝つ組み合わせなら加算
    if (winnerId === cpu.id) {

      winningWeight += weight;

    }

  }


  // =====================================
  // 組み合わせを再帰的に調べる
  // =====================================

  function explore(
    index,
    usedColors,
    assignment,
    weight
  ) {

    if (index >= opponents.length) {

      evaluateAssignment(
        assignment,
        weight
      );

      return;
    }

    const opponent = opponents[index];

    const belief = beliefs[opponent.id];

    if (!belief) {
      return;
    }

    const observations =
      belief.observations || 0;

    const confidence = Math.min(
      1,
      observations / 6
    );

    const sensitivity =
      0.35 + confidence * 0.65;

    const maxScore = Math.max(
      ...availableColors.map(
        color => belief.scores[color] || 0
      )
    );

    availableColors.forEach(color => {

      if (usedColors.has(color)) {
        return;
      }

      const score =
        belief.scores[color] || 0;

      const exponent =
        ((score - maxScore) / 55) *
        sensitivity;

      const nextWeight =
        weight * Math.exp(exponent);

      usedColors.add(color);

      assignment[opponent.id] = color;

      explore(
        index + 1,
        usedColors,
        assignment,
        nextWeight
      );

      usedColors.delete(color);

      delete assignment[opponent.id];

    });

  }


  explore(
    0,
    new Set(),
    {},
    1
  );


  // =====================================
  // 勝率を返す（0～1）
  // =====================================

  if (totalWeight <= 0) {
    return 0;
  }

  return winningWeight / totalWeight;

}





/* =====================================
   新しく受け取ったカードの強調表示
===================================== */

const newHandCards = new Map();

const NEW_CARD_HIGHLIGHT_MS = 3000;

function highlightNewHandCards(cards) {

  const sessionId = gameSessionId;

  cards.forEach(card => {

    const expiresAt =
      Date.now() + NEW_CARD_HIGHLIGHT_MS;

    newHandCards.set(card.id, expiresAt);

    setTimeout(() => {

      // 別のゲームに切り替わっていたら終了
      if (sessionId !== gameSessionId) {
        return;
      }

      // 同じカードの強調表示が更新されていたら残す
      if (newHandCards.get(card.id) !== expiresAt) {
        return;
      }

      newHandCards.delete(card.id);

      document
        .querySelector(
          `.hand-card[data-card-id="${card.id}"]`
        )
        ?.classList.remove("new-hand-card");

    }, NEW_CARD_HIGHLIGHT_MS);

  });

}



let cardSequence = 0;
let busy = false;
let closeActiveReveal = null;

/* ========================================
   STEP 3-7 進行管理
======================================== */

// ゲームを開始するたびに更新する番号
let gameSessionId = 0;

// 現在の手番処理が進行中か
let turnProcessing = false;

// アニメーション用の要素
const activeAnimations = new Set();

function isCurrentGame(sessionId) {
  return (
    sessionId === gameSessionId &&
    !gameOver
  );
}


// ========================================
// 共通処理
// ========================================

const $ = id => document.getElementById(id);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shuffle(array) {

  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {

    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] =
      [result[j], result[i]];
  }

  return result;
}

function createCard(color, zodiac) {

  return {
    id: ++cardSequence,
    color,
    zodiac
  };
}


function getCardImage(card) {

  // 猫
  if (card.zodiac === "猫") {
    return "images/黒13.png";
  }

  // 干支を番号に変換（子=1 ～ 亥=12）
  const number = ZODIACS.indexOf(card.zodiac) + 1;

  return `images/${card.color}${number}.png`;
}


function getCpuDelay() {

  if (cpuSpeed === "fast") return 300;
  if (cpuSpeed === "slow") return 2000;

  return 1000;
}

// ========================================
// カード表示
// ========================================

function createCardElement(card, className = "") {

  const wrapper = document.createElement("div");

  wrapper.className =
    `${className} card-placeholder ` +
    COLOR_CLASSES[card.color];

  const zodiac = document.createElement("div");
  zodiac.className = "card-zodiac";
  zodiac.textContent = card.zodiac;

  const color = document.createElement("div");
  color.className = "card-color";
  color.textContent = card.color;

  wrapper.append(zodiac, color);

  // 画像が存在すれば自動で画像表示
  const image = new Image();

  image.onload = () => {

    if (!wrapper.isConnected) return;

    wrapper.replaceChildren(image);

    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "cover";
  };

  image.src = getCardImage(card);

  return wrapper;
}

// ========================================
// 対戦人数設定
// ========================================

document.querySelectorAll(".player-option")
  .forEach(button => {

    button.addEventListener("click", () => {

      playerCount = Number(button.dataset.players);

      document.querySelectorAll(".player-option")
        .forEach(item =>
          item.classList.remove("active")
        );

      button.classList.add("active");

      const count =
        playerCount === 2 ? 19 :
        playerCount === 3 ? 17 : 13;

      $("setup-description").textContent =
        `${playerCount}人対戦 ／ 手札${count}枚ずつ`;
    });
  });

// ========================================
// ゲーム開始
// ========================================

$("start-button").addEventListener("click", startGame);

function startGame() {

    gameSessionId++;
    newHandCards.clear();


    

clearGameAnimations();

if (closeActiveReveal) {
  closeActiveReveal();
}

busy = false;
turnProcessing = false;

  $("result-overlay")?.remove();
  $("return-result-button")?.remove();

  cardSequence = 0;
  players = [];
  field = {};
  catPile = [];
  cpuColorPredictions = {};

  selectedCardId = null;
  handSort = "zodiac";
  firstTurn = true;
  gameOver = false;
  busy = false;
  phase = "play";

  ZODIACS.forEach(zodiac => {
    field[zodiac] = [];
  });

  // 2人の場合は3色のみ使用
  const availableColors =
    playerCount === 2
      ? COLORS.slice(0, 3)
      : COLORS;

// 2人プレイでは緑の得点欄を非表示
const greenScore = document.querySelector(
  ".count-green"
);

if (greenScore) {
  greenScore.style.display =
    playerCount === 2 ? "none" : "";
}

  const assignedColors =
    shuffle(availableColors).slice(0, playerCount);

  players = Array.from(
    { length: playerCount },
    (_, index) => ({
      id: index,
      name: index === 0 ? "あなた" : `CPU ${index}`,
      color: assignedColors[index],
      hand: [],
      eliminated: false
    })
  );

    initializeCpuColorBeliefs();

  let deck = [];

  availableColors.forEach(color => {

    ZODIACS.forEach(zodiac => {
      deck.push(createCard(color, zodiac));
    });
  });

  for (let i = 0; i < playerCount; i++) {
    deck.push(createCard("黒", "猫"));
  }

  deck = shuffle(deck);

  deck.forEach((card, index) => {
    players[index % playerCount].hand.push(card);
  });

  // 赤亥を持つプレイヤーが先攻
  currentPlayerIndex = players.findIndex(player =>
    player.hand.some(card =>
      card.color === "赤" &&
      card.zodiac === "亥"
    )
  );

  $("setup-screen").classList.add("hidden");
  $("game-screen").classList.remove("hidden");

  renderAll();
  requestAnimationFrame(resizeGame);

  startTurn();
}

// ========================================
// プレイヤー表示
// ========================================

function renderPlayers() {

  const positions = {
    2: {
      1: "cpu-top"
    },

    3: {
      1: "cpu-left",
      2: "cpu-right"
    },

    4: {
      1: "cpu-left",
      2: "cpu-top",
      3: "cpu-right"
    }
  };

  // =====================================
  // CPU表示を初期化
  // =====================================

  ["cpu-top", "cpu-left", "cpu-right"]
    .forEach(id => {
      $(id).replaceChildren();
    });

  // =====================================
  // CPUの表示
  // =====================================

  players.slice(1).forEach(player => {

    const targetId =
      positions[playerCount][player.id];

    const panel = document.createElement("div");
    panel.className = "player-panel";

    // =====================================
    // 現在の手番
    // =====================================

    if (player.id === currentPlayerIndex) {
      panel.classList.add("active-turn");
    }

    // =====================================
    // 脱落状態
    // =====================================

    if (player.eliminated) {
      panel.classList.add("eliminated");
    }

    // =====================================
    // CPU名
    // =====================================

    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name;

    // =====================================
    // 手札枚数
    // =====================================

    const details = document.createElement("div");
    details.className = "player-details";

    details.textContent =
      `手札：${player.hand.length}枚`;

    if (player.eliminated) {
      details.textContent += " ／ 脱落";
    }

    // =====================================
    // CPU担当色の予想
    // =====================================

    const prediction =
      cpuColorPredictions[player.id] || "";

    // 予想した色でパネルを色付け
    if (prediction) {

      panel.classList.add(
        `cpu-prediction-${prediction}`
      );

    }

    // =====================================
    // 予想色の表示
    // =====================================

    const predictionText =
      document.createElement("div");

    predictionText.className =
      "cpu-prediction-text";

    predictionText.textContent =
      prediction
        ? `予想：${prediction}`
        : "色を予想";

    // =====================================
    // パネルをタップして色を選択
    // =====================================

    panel.addEventListener("click", () => {

      showCpuColorPicker(player.id);

    });

    // =====================================
    // CPUパネルに表示
    // =====================================

    panel.append(
      name,
      details,
      predictionText
    );

    $(targetId).appendChild(panel);

  });

  // =====================================
  // 自分の情報
  // =====================================

  const me = players[0];

  const myInfo = $("my-info");

  myInfo.replaceChildren();

  const colorClass = {
    "赤": "red",
    "青": "blue",
    "黄": "yellow",
    "緑": "green"
  };

  myInfo.innerHTML = `
    <span>あなた ／ 担当：</span>
    <span class="my-color-badge ${colorClass[me.color]}">
      ${me.color}
    </span>
    <span>
      ／ 手札：${me.hand.length}枚
      ${me.eliminated ? "／ 脱落" : ""}
    </span>
  `;

}


/* ========================================
   CPU担当色の予想選択
======================================== */

function showCpuColorPicker(playerId) {

  // 以前の選択画面があれば削除
  document.getElementById(
    "cpu-color-picker"
  )?.remove();

  const overlay = document.createElement("div");
  overlay.id = "cpu-color-picker";

  const panel = document.createElement("div");
  panel.className = "cpu-picker-panel";

  const title = document.createElement("div");
  title.className = "cpu-picker-title";
  title.textContent =
    `CPU ${playerId} の担当色を予想`;

  const buttons = document.createElement("div");
  buttons.className = "cpu-picker-buttons";

  const colors = playerCount === 2
    ? ["赤", "青", "黄", "未設定"]
    : ["赤", "青", "黄", "緑", "未設定"];

  colors.forEach(color => {

    const button = document.createElement("button");

    button.type = "button";
    button.className = "cpu-color-button";
    button.textContent = color;

    if (color !== "未設定") {
      button.classList.add(
        `cpu-choice-${color}`
      );
    }

    button.addEventListener("click", () => {

      cpuColorPredictions[playerId] =
        color === "未設定" ? "" : color;

      overlay.remove();

      renderPlayers();

    });

    buttons.appendChild(button);

  });

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "cpu-picker-cancel";
  cancel.textContent = "キャンセル";

  cancel.addEventListener("click", () => {
    overlay.remove();
  });

  panel.append(title, buttons, cancel);
  overlay.appendChild(panel);

document
  .getElementById("game-board")
  .appendChild(overlay);

}

// ========================================
// 場の表示
// ========================================


function renderField() {

  const container = $("zodiac-field");
  container.replaceChildren();

  // 干支カード12種類
  ZODIACS.forEach(zodiac => {

    const slot = document.createElement("div");
    slot.className = "zodiac-slot";
    slot.dataset.zodiac = zodiac;

    const pile = field[zodiac];

    const offset =
      pile.length > 1
        ? Math.min(12, 30 / (pile.length - 1))
        : 0;

    pile.forEach((card, index) => {

      const element = createCardElement(
        card,
        "pile-card"
      );

      element.style.top =
        `${5 + index * offset}px`;

      element.style.zIndex = index + 1;

      slot.appendChild(element);
    });

    const label = document.createElement("div");
    label.className = "slot-label";

    label.textContent =
      pile.length
        ? `${zodiac} ${pile.length}枚`
        : zodiac;

    slot.appendChild(label);
    container.appendChild(slot);
  });

  // 猫カードの山
  const catContainer = $("cat-cards");
  catContainer.replaceChildren();

  const offset =
    catPile.length > 1
      ? Math.min(12, 30 / (catPile.length - 1))
      : 0;

  catPile.forEach((card, index) => {

    const element = createCardElement(
      card,
      "pile-card"
    );

    element.style.top =
      `${5 + index * offset}px`;

    element.style.left = "5px";
    element.style.zIndex = index + 1;

    catContainer.appendChild(element);
  });

  const label = document.createElement("div");
  label.className = "slot-label";

  label.textContent =
    catPile.length
      ? `猫 ${catPile.length}枚`
      : "猫";

  catContainer.appendChild(label);

  // =====================================
  // 各色の得点を更新
  // =====================================

  updateColorCounts();
}


// ========================================
// 手札表示
// ========================================

function getSortedHand() {

  const cards = [...players[0].hand];

  const zodiacOrder = [...ZODIACS, "猫"];
  const colorOrder = [...COLORS, "黒"];

  cards.sort((a, b) => {

    const z =
      zodiacOrder.indexOf(a.zodiac) -
      zodiacOrder.indexOf(b.zodiac);

    const c =
      colorOrder.indexOf(a.color) -
      colorOrder.indexOf(b.color);

    return handSort === "zodiac"
      ? z || c
      : c || z;
  });

  return cards;
}

function renderHand() {

  const container = $("my-hand");
  container.replaceChildren();

  const cards = getSortedHand();

  const width = container.clientWidth || 900;

  const step =
    cards.length <= 1
      ? 0
      : Math.min(
          100,
          (width - 104) / (cards.length - 1)
        );

  cards.forEach((card, index) => {

const element =
  createCardElement(card, "hand-card");

element.dataset.cardId = card.id;

// =====================================
// 最初の赤の亥を発光させる
// =====================================

if (
  firstTurn &&
  currentPlayerIndex === 0 &&
  card.color === "赤" &&
  card.zodiac === "亥"
) {

  element.classList.add(
    "first-red-boar"
  );

}


// 新しく受け取ったカードなら点滅表示
if (
  newHandCards.has(card.id) &&
  newHandCards.get(card.id) > Date.now()
) {

  element.classList.add("new-hand-card");

}


    element.style.left =
      `${4 + index * step}px`;

    element.style.zIndex = index + 1;

    if (selectedCardId === card.id) {

      element.classList.add("selected");
      element.style.zIndex = cards.length + 10;
    }

    element.addEventListener("click", () => {

      if (busy || gameOver) return;
      if (currentPlayerIndex !== 0) return;

      selectedCardId =
        selectedCardId === card.id
          ? null
          : card.id;

      renderHand();
      updateButtons();
    });

    container.appendChild(element);
  });
}

// ========================================
// 得点
// ========================================

function calculateScore(color) {

  let score = 0;

  ZODIACS.forEach(zodiac => {

    const pile = field[zodiac];

    if (
      pile.length &&
      pile[pile.length - 1].color === color
    ) {
      score++;
    }
  });

  return score;
}

// ========================================
// カードを出せるか
// ========================================

function canPlayCard(card) {

  if (card.zodiac === "猫") {
    return true;
  }

  // 子は丑が場に必要
  if (
    card.zodiac === "子" &&
    field["丑"].length === 0
  ) {
    return false;
  }

  // 巳は辰の枚数を超えられない
  if (
    card.zodiac === "巳" &&
    field["巳"].length + 1 >
    field["辰"].length
  ) {
    return false;
  }

  return true;
}

// ========================================
// 手番開始
// ========================================



async function startTurn() {

  // 現在のゲーム番号を保存
  const sessionId = gameSessionId;

  if (!isCurrentGame(sessionId)) return;
  if (checkGameEnd()) return;

  const player = players[currentPlayerIndex];

  if (!player) return;

  if (player.eliminated) {
    advanceTurn();
    return;
  }

  phase = "play";
  selectedCardId = null;

  // 新しい手番の開始時に操作状態を初期化
  turnProcessing = false;
  busy = false;


  renderAll();

  // =====================================
  // プレイヤーの手番
  // =====================================


  if (player.id === 0) {


if (firstTurn) {

  showMessage(
    "赤の亥（い）からゲームが始まります。赤の亥（い）を場に出してください。"
  );

} else {

  showMessage(
    "カードを選んで場に出してください"
  );

}


    if (!hasPlayableCard(player)) {

      phase = "pass";

      busy = true;
      turnProcessing = true;

      updateButtons();

      await showRevealModal(
        "あなたの手札公開",
        "出せるカードがないため、手札を公開します。",
        player.hand
      );

      // 公開中に別のゲームになった場合は中断
      if (!isCurrentGame(sessionId)) return;

      busy = false;
      turnProcessing = false;

      showMessage(
        "渡すカードを1枚選んでください"
      );
    }

    updateButtons();
    return;
  }

  // =====================================
  // CPUの手番
  // =====================================

  busy = true;
  turnProcessing = true;

  // CPUの行動中であることを表示
  showMessage(
    "CPUが行動中"
  );

  updateButtons();

  await sleep(getCpuDelay());

  // 別のゲームが開始されていたら中断
  if (!isCurrentGame(sessionId)) return;

  await cpuTakeTurn(player);

  // 次の手番の startTurn() でロックを初期化
}



// ========================================
// 出せるカードの確認
// ========================================

function hasPlayableCard(player) {

  return player.hand.some(card => {

    if (firstTurn) {

      return card.color === "赤" &&
             card.zodiac === "亥";
    }

    return canPlayCard(card);
  });
}

// ========================================
// プレイヤーの操作
// ========================================


$("play-button").addEventListener("click", async () => {

  if (!canHumanOperate()) return;
  if (phase !== "play") return;

  const player = players[0];

  const card = player.hand.find(
    item => item.id === selectedCardId
  );

  if (!card) return;

  // =====================================
  // カード使用条件
  // =====================================

  if (firstTurn) {

    if (
      card.color !== "赤" ||
      card.zodiac !== "亥"
    ) {

      showMessage(
        "最初は赤の亥を出してください"
      );

      return;
    }

  } else if (!canPlayCard(card)) {

    showMessage(
      "このカードはまだ出せません"
    );

    return;
  }

  // =====================================
  // 操作ロック
  // =====================================

  busy = true;
  turnProcessing = true;

  updateButtons();

  // =====================================
  // カードを出す
  // =====================================

const sessionId = gameSessionId;

await playCard(player, card);

if (!isCurrentGame(sessionId)) return;

  if (checkGameEnd()) return;

  // =====================================
  // 受け渡しフェーズ
  // =====================================

  phase = "pass";
  selectedCardId = null;

  renderAll();

  if (player.hand.length === 0) {

    // 手札がなくなった場合は終了
    finishTurn();
    return;
  }

  // 次の操作を許可
  busy = false;
  turnProcessing = false;

  showMessage(
    "左隣に渡すカードを選んでください"
  );

  updateButtons();
});



$("pass-button").addEventListener("click", async () => {

  if (!canHumanOperate()) return;
  if (phase !== "pass") return;

  const player = players[0];

  const card = player.hand.find(
    item => item.id === selectedCardId
  );

  if (!card) {

    showMessage(
      "左隣に渡すカードを選んでください"
    );

    return;
  }

  // =====================================
  // 操作ロック
  // =====================================

  busy = true;
  turnProcessing = true;

  updateButtons();

  // =====================================
  // カード受け渡し
  // =====================================

const sessionId = gameSessionId;

await passCard(player, card);

if (!isCurrentGame(sessionId)) return;

  // ロックを維持したまま次の手番へ
  finishTurn();
});



/* ========================================
   CPU戦略評価用
======================================== */

// 現在の場の得点を計算
function getFieldScores(targetField = field) {

  const scores = {};

  COLORS.forEach(color => {
    scores[color] = 0;
  });

  ZODIACS.forEach(zodiac => {

    const pile = targetField[zodiac];

    if (!pile || pile.length === 0) {
      return;
    }

    const top = pile[pile.length - 1];

    if (scores[top.color] !== undefined) {
      scores[top.color]++;
    }
  });

  return scores;
}


// 場の状態を複製
function cloneField() {

  const copy = {};

  ZODIACS.forEach(zodiac => {
    copy[zodiac] = [...field[zodiac]];
  });

  return copy;
}


// カードを出した後の場を予測
function simulateCpuPlay(card) {

  const nextField = cloneField();

  if (card.zodiac === "猫") {
    return nextField;
  }

  nextField[card.zodiac].push(card);

  // 申を出すと戌の一番上が一番下へ
  if (
    card.zodiac === "申" &&
    nextField["戌"].length > 1
  ) {

    const top = nextField["戌"].pop();
    nextField["戌"].unshift(top);
  }

  // 戌を出すと申の一番上が一番下へ
  if (
    card.zodiac === "戌" &&
    nextField["申"].length > 1
  ) {

    const top = nextField["申"].pop();
    nextField["申"].unshift(top);
  }

  return nextField;
}


// 現在の場が完成しているか
function isFieldComplete(targetField) {

  return ZODIACS.every(zodiac =>
    targetField[zodiac].length > 0
  );
}


// 得点同点時の勝者を判定
function getPredictedWinner(targetField) {

  const scores = getFieldScores(targetField);

  const maxScore = Math.max(
    ...players.map(player => scores[player.color])
  );

  const tiedPlayers = players.filter(
    player => scores[player.color] === maxScore
  );

  if (tiedPlayers.length === 1) {
    return tiedPlayers[0];
  }

  // 子から亥の順で比較
  for (const zodiac of ZODIACS) {

    const pile = targetField[zodiac];

    if (!pile.length) continue;

    const top = pile[pile.length - 1];

    const winner = tiedPlayers.find(
      player => player.color === top.color
    );

    if (winner) {
      return winner;
    }
  }

  return tiedPlayers[0];
}


// ========================================
// CPUの戦略判断
// ========================================



function evaluateCpuCard(player, card) {

  const currentScores = getFieldScores();

  const nextField = simulateCpuPlay(card);

  const nextScores = getFieldScores(nextField);

  const myColor = player.color;

  let points = 0;


  // =====================================
  // 1. 自分の得点変化
  // =====================================

  const myGain =
    nextScores[myColor] -
    currentScores[myColor];

  points += myGain * 100;


  // =====================================
  // 2. 相手の予想得点変化
  // =====================================

  players.forEach(opponent => {

    if (opponent.id === player.id) {
      return;
    }

    const probabilities =
      getCpuColorProbabilities(
        player.id,
        opponent.id
      );

    let expectedGain = 0;

    getCpuInferenceColors().forEach(color => {

      const gain =
        nextScores[color] -
        currentScores[color];

      expectedGain +=
        gain *
        (probabilities[color] || 0);

    });

    points -= expectedGain * 65;

  });


  // =====================================
  // 3. 自分の担当色を優先
  // =====================================

  if (card.color === myColor) {
    points += 18;
  }


  // =====================================
  // 4. 山の上書き
  // =====================================

  if (card.zodiac !== "猫") {

    const pile = field[card.zodiac];

    if (pile.length > 0) {

      const top = pile[pile.length - 1];

      if (
        top.color !== myColor &&
        card.color === myColor
      ) {
        points += 35;
      }

      if (
        top.color === myColor &&
        card.color !== myColor
      ) {
        points -= 100;
      }

    }

  }


  // =====================================
  // 5. 自分の色を最初に置くリスク
  // =====================================

  if (
    card.zodiac !== "猫" &&
    card.color === myColor &&
    field[card.zodiac].length === 0
  ) {

    const zodiacCount = ZODIACS.filter(
      zodiac => field[zodiac].length > 0
    ).length;

    let avoidProbability = 0;
    let avoidPenalty = 0;

    if (zodiacCount <= 3) {

      avoidProbability = 0.65;
      avoidPenalty = 60;

    } else if (zodiacCount <= 7) {

      avoidProbability = 0.40;
      avoidPenalty = 20;

    } else {

      avoidProbability = 0.20;
      avoidPenalty = 10;

    }

    if (Math.random() < avoidProbability) {
      points -= avoidPenalty;
    }

  }


  // =====================================
  // 6. 新しい干支を出す判断
  // =====================================

  if (
    card.zodiac !== "猫" &&
    field[card.zodiac].length === 0
  ) {

    points += 10;

    const myScore = currentScores[myColor];

    let opponentBest = 0;

    players.forEach(opponent => {

      if (opponent.id === player.id) {
        return;
      }

      const expectedScore =
        getCpuExpectedOpponentScore(
          player,
          opponent,
          currentScores
        );

      opponentBest = Math.max(
        opponentBest,
        expectedScore
      );

    });

    if (myScore > opponentBest) {
      points += 20;
    }

    if (myScore < opponentBest) {
      points -= 15;
    }

  }



  // =====================================
  // 7. ゲーム終了時の勝率予測
  // =====================================

  if (isFieldComplete(nextField)) {

    const winProbability =
      evaluateCpuEnding(
        player,
        nextField
      );

    // 勝率50%を基準に評価
    points +=
      (winProbability - 0.5) * 10000;

  }



  // =====================================
  // 8. 猫カード
  // =====================================

  if (card.zodiac === "猫") {

    points += 10;

    const myRats = player.hand.filter(
      item => item.zodiac === "子"
    ).length;

    points -= myRats * 20;

  }



  // =====================================
  // 子・丑を少し温存する
  // =====================================

  if (
    card.zodiac === "子" ||
    card.zodiac === "丑"
  ) {

    // 場に出ている干支の種類数
    const zodiacCount = ZODIACS.filter(
      zodiac => field[zodiac].length > 0
    ).length;

    const pileCount =
      field[card.zodiac].length;

    let keepPenalty = 0;

    // ===================================
    // 序盤
    // ===================================

    if (zodiacCount <= 3) {

      keepPenalty =
        card.zodiac === "子" ? 20 : 25;

    // ===================================
    // 中盤
    // ===================================

    } else if (zodiacCount <= 7) {

      keepPenalty =
        card.zodiac === "子" ? 12 : 15;

    // ===================================
    // 終盤
    // ===================================

    } else if (zodiacCount <= 9) {

      keepPenalty =
        card.zodiac === "子" ? 5 : 6;

    // ===================================
    // 最終盤
    // ===================================

    } else {

      keepPenalty = 0;

    }

    // ===================================
    // 山の3枚目・4枚目は温存を弱める
    // ===================================

    if (pileCount === 2) {

      keepPenalty *= 0.5;

    } else if (pileCount === 3) {

      keepPenalty = 0;

    }

    // ===================================
    // ゲーム終了時は勝敗予測を優先
    // ===================================

    if (!isFieldComplete(nextField)) {

      points -= keepPenalty;

    }

  }




  // =====================================
  // 9. ランダム性
  // =====================================

  points += Math.random() * 3;

  return points;

}




function chooseCpuPlay(player) {

  // =====================================
  // 1. 出せるカードを取得
  // =====================================

  let candidates = player.hand.filter(
    card => canPlayCard(card)
  );

  // 最初の手番は赤亥を必ず出す
  if (firstTurn) {

    candidates = player.hand.filter(
      card =>
        card.color === "赤" &&
        card.zodiac === "亥"
    );

  }

  if (candidates.length === 0) {
    return null;
  }

  // =====================================
  // 2. ゲーム終了カードを判定
  // =====================================

  const safeCards = [];

  const winningCards = [];

  const endingCards = [];

  candidates.forEach(card => {

    // カードを出した後の場を予測
    const nextField = simulateCpuPlay(card);

    // 12種類の干支がそろうか
    const endsGame = isFieldComplete(nextField);

    if (!endsGame) {

      // ゲームが終了しないカード
      safeCards.push(card);

      return;
    }


    // ===================================
    // 推理に基づく勝敗予測
    // ===================================


    // ===================================
    // 干支順を含めた勝率予測
    // ===================================

    const winProbability =
      evaluateCpuEnding(
        player,
        nextField
      );

    if (winProbability > 0.5) {

      // 勝率50%超なら終了候補
      winningCards.push(card);

    } else {

      // 勝率50%以下なら慎重に判断
      endingCards.push(card);

    }



  });

  // =====================================
  // 3. 使用候補を決定
  // =====================================

  if (winningCards.length > 0) {

    // 自分が勝てるなら終了を優先
    candidates = winningCards;

  } else if (safeCards.length > 0) {

    // 勝てない場合は終了しないカードを優先
    candidates = safeCards;

  } else {

    // 出せるカードがすべて終了カードなら
    // ゲーム終了を許可
    candidates = endingCards;

  }

  // =====================================
  // 4. 従来の戦略評価
  // =====================================

  const evaluated = candidates.map(card => ({
    card,
    points: evaluateCpuCard(player, card)
  }));

  evaluated.sort(
    (a, b) => b.points - a.points
  );

  // =====================================
  // 5. 判断ログ
  // =====================================

  console.log(
    "CPU行動評価",
    player.name,
    {
      safeCards: safeCards.length,
      winningCards: winningCards.length,
      endingCards: endingCards.length,
      evaluated: evaluated.map(item => ({
        card: item.card.color + item.card.zodiac,
        points: Math.round(item.points)
      }))
    }
  );

  return evaluated[0].card;

}





function chooseCpuPass(player) {

  const next = getNextActivePlayer(player.id);

  if (!next || player.hand.length === 0) {
    return null;
  }

  // =====================================
  // 次のプレイヤーの担当色を推理
  // =====================================

  const probabilities =
    getCpuColorProbabilities(
      player.id,
      next.id
    );

  // =====================================
  // 各カードを評価
  // =====================================

  const evaluated = player.hand.map(card => {

    let points = 0;

    // ===================================
    // 1. 自分の担当色は渡したくない
    // ===================================

    if (card.color === player.color) {
      points -= 100;
    }

    // ===================================
    // 2. 相手の推理担当色を考慮
    // ===================================

    if (card.zodiac !== "猫") {

      const probability =
        probabilities[card.color] || 0;

      // 担当色である可能性が高いほど
      // 渡す評価を下げる
      points -= probability * 80;

    }

    // ===================================
    // 3. 相手が場に出せるカード
    // ===================================

    if (canPlayCard(card)) {
      points -= 20;
    }

    // ===================================
    // 4. 自分の得点を上書きする危険
    // ===================================

    if (card.zodiac !== "猫") {

      const pile = field[card.zodiac];

      if (pile.length > 0) {

        const top = pile[pile.length - 1];

        if (
          top.color === player.color &&
          card.color !== player.color
        ) {
          points -= 50;
        }

      }

    }

    // ===================================
    // 5. 猫カード
    // ===================================

    if (card.zodiac === "猫") {
      points -= 100;
    }



    // ===================================
    // 干支の番号が大きいカードを渡しやすくする
    // ===================================

    if (card.zodiac !== "猫") {

      const zodiacNumber =
        ZODIACS.indexOf(card.zodiac) + 1;

      // 1（子）から12（亥）まで
      // 数字が大きいほど渡す評価を上げる
      points += (zodiacNumber - 1) * 2;

      // 子・丑は特に温存する
      if (card.zodiac === "子") {
        points -= 5;
      }

      if (card.zodiac === "丑") {
        points -= 8;
      }

    }


    // ===================================
    // 6. ランダム性
    // ===================================

    points += Math.random() * 8;

    return {
      card,
      points
    };

  });

  // =====================================
  // 評価が高いカードを優先
  // =====================================

  evaluated.sort(
    (a, b) => b.points - a.points
  );

  // =====================================
  // 判断ログ
  // =====================================

  console.log(
    "CPU受け渡し評価",
    player.name,
    {
      nextPlayer: next.name,
      probabilities: probabilities,
      cards: evaluated.map(item => ({
        card:
          item.card.color +
          item.card.zodiac,
        points: Math.round(item.points)
      }))
    }
  );

  return evaluated[0].card;

}



// ========================================
// CPUの手番
// ========================================



async function cpuTakeTurn(player) {

  // =====================================
  // 現在のゲーム番号を保存
  // =====================================

  const sessionId = gameSessionId;

  if (!isCurrentGame(sessionId)) {
    return;
  }

  // =====================================
  // CPUが出すカードを選択
  // =====================================

  const card = chooseCpuPlay(player);

  if (card) {

    // ===================================
    // カードを場に出す
    // ===================================

    await playCard(player, card);

    // ゲームが切り替わっていたら中断
    if (!isCurrentGame(sessionId)) {
      return;
    }

    // カードを出した時点で終了判定
    if (checkGameEnd()) {
      return;
    }

  } else {

    // ===================================
    // 出せるカードがない場合
    // ===================================

    await revealCpuHand(player);

    // 手札公開中にゲームが変わったら中断
    if (!isCurrentGame(sessionId)) {
      return;
    }
  }

  // =====================================
  // 左隣へカードを渡す
  // =====================================

  // 脱落したCPUはカードを渡せない
  if (
    !player.eliminated &&
    player.hand.length > 0
  ) {

    const pass = chooseCpuPass(player);

    if (pass) {

      await passCard(player, pass);

      // 受け渡し中にゲームが変わったら中断
      if (!isCurrentGame(sessionId)) {
        return;
      }
    }
  }

  // =====================================
  // 手番終了
  // =====================================

  if (!isCurrentGame(sessionId)) {
    return;
  }

  finishTurn();
}


// ========================================
// カードを場に出す
// ========================================




async function playCard(player, card) {

  // この処理を開始したゲームの番号
  const sessionId = gameSessionId;

  // =====================================
  // カード移動アニメーション
  // =====================================

const moved = await animateCardMove(
  player.id,
  card,
  "field"
);

if (!moved || !isCurrentGame(sessionId)) {
  return;
}

  // =====================================
  // 手札からカードを取り除く
  // =====================================

  player.hand = player.hand.filter(
    item => item.id !== card.id
  );

  // =====================================
  // 猫
  // =====================================

  if (card.zodiac === "猫") {

    catPile.push(card);

    renderField();

    await resolveCatEffect(player);

    // 猫の効果中にゲームが変わった場合
    if (!isCurrentGame(sessionId)) return;


  } else {

    // ===================================
    // 通常の干支カード
    // ===================================

    // カードを置く前の山の状態を保存
    const previousPile = [
      ...field[card.zodiac]
    ];

    // CPUが出されたカードを観察して推理
    observeCpuPlayedCard(
      player,
      card,
      previousPile
    );

    // 実際にカードを場へ出す
    field[card.zodiac].push(card);

    renderField();



    // ===================================
    // 申の効果
    // 戌が2枚以上ある場合のみ発動
    // ===================================

    if (
      card.zodiac === "申" &&
      field["戌"].length >= 2
    ) {

await showSpecialEffect(
  "申（さる）の効果！\n戌（いぬ）の一番上のカードを一番下へ移動します",
  2000
);

      if (!isCurrentGame(sessionId)) return;

      await rotatePile("戌");

      if (!isCurrentGame(sessionId)) return;
    }

    // ===================================
    // 戌の効果
    // 申が2枚以上ある場合のみ発動
    // ===================================

    if (
      card.zodiac === "戌" &&
      field["申"].length >= 2
    ) {

await showSpecialEffect(
  "戌（いぬ）の効果！\n申（さる）の一番上のカードを一番下へ移動します",
  2000
);

      if (!isCurrentGame(sessionId)) return;

      await rotatePile("申");

      if (!isCurrentGame(sessionId)) return;
    }

  }


  // =====================================
  // 最終確認
  // =====================================

  if (!isCurrentGame(sessionId)) return;

  // 赤の亥を出したら最初の手番を終了
  if (
    firstTurn &&
    card.color === "赤" &&
    card.zodiac === "亥"
  ) {
    firstTurn = false;
  }

  updateEliminations();

  renderAll();
}





// ========================================
// 申・戌の効果
// ========================================



async function rotatePile(zodiac) {

  // =====================================
  // 現在のゲーム番号を保存
  // =====================================

  const sessionId = gameSessionId;

  if (!isCurrentGame(sessionId)) {
    return;
  }

  // =====================================
  // 対象の山を取得
  // =====================================

  const pile = field[zodiac];

  if (!pile || pile.length === 0) {
    return;
  }

  // =====================================
  // 山の強調表示
  // =====================================

  await highlightZodiacPile(zodiac);

  // 強調表示中にゲームが変わったら中断
  if (!isCurrentGame(sessionId)) {
    return;
  }

  // =====================================
  // カードが1枚以下なら入れ替え不要
  // =====================================

  if (pile.length <= 1) {
    return;
  }

  // =====================================
  // 一番上のカードを一番下へ移動
  // =====================================

  const topCard = pile.pop();

  pile.unshift(topCard);

  renderField();

  // =====================================
  // 演出後の待機
  // =====================================

  await sleep(350);

  // 待機中にゲームが変わったら中断
  if (!isCurrentGame(sessionId)) {
    return;
  }
}




/* ========================================
   猫の特殊効果
======================================== */



async function resolveCatEffect(actor) {

  // =====================================
  // 現在のゲーム番号を保存
  // =====================================

  const sessionId = gameSessionId;

  if (!isCurrentGame(sessionId)) {
    return;
  }

  // =====================================
  // 猫の効果メッセージ
  // =====================================

await showSpecialEffect(
  "猫（ねこ）の効果！\n全員の子（ね）を逆方向へ渡します",
  2000
);

  if (!isCurrentGame(sessionId)) {
    return;
  }

  // =====================================
  // 1. 効果開始時の参加プレイヤー
  // =====================================

  const activePlayers = players.filter(
    player => !player.eliminated
  );

  const transfers = [];

  // =====================================
  // 2. 全員の子カードを取得
  // =====================================

  activePlayers.forEach(player => {

    const rats = player.hand.filter(
      card => card.zodiac === "子"
    );

    if (rats.length === 0) {
      return;
    }

    const previous =
      getPreviousActivePlayer(player.id);

    if (!previous) {
      return;
    }

    transfers.push({
      from: player,
      to: previous,
      cards: [...rats]
    });

  });

  // =====================================
  // 3. 子カードを公開
  // =====================================

  const revealed = await showCatRevealModal(
    transfers
  );

  // ゲーム終了・公開キャンセルなら中断
  if (
    !revealed ||
    !isCurrentGame(sessionId)
  ) {
    return;
  }

  // =====================================
  // 4. カード移動アニメーション
  // =====================================

  const moved = await animateCatTransfers(
    transfers
  );

  if (
    !moved ||
    !isCurrentGame(sessionId)
  ) {
    return;
  }

  // =====================================
  // 5. 全員の手札から子を取り除く
  // =====================================

  // 全員分の移動元を先に更新する
  transfers.forEach(transfer => {

    const ids = new Set(
      transfer.cards.map(card => card.id)
    );

    transfer.from.hand =
      transfer.from.hand.filter(
        card => !ids.has(card.id)
      );

  });

  // =====================================
  // 6. 移動先にカードを追加
  // =====================================

  // 全員分の削除が終わってから追加する
  transfers.forEach(transfer => {

    transfer.to.hand.push(
      ...transfer.cards
    );

    // ===================================
    // 新しく自分が受け取った子カードを強調
    // ===================================

    if (transfer.to.id === 0) {

      highlightNewHandCards(
        transfer.cards
      );

    }

  });

  // =====================================
  // 7. 脱落判定
  // =====================================

  updateEliminations();

  // =====================================
  // 8. 表示更新
  // =====================================

  renderAll();

  // =====================================
  // 9. 完了メッセージ
  // =====================================

  await showSpecialEffect(
    "子（ね）の移動が完了しました",
    1000
  );

  if (!isCurrentGame(sessionId)) {
    return;
  }

}



// ========================================
// 手札を渡す
// ========================================


async function passCard(player, card) {

  // =====================================
  // 現在のゲーム番号を保存
  // =====================================

  const sessionId = gameSessionId;

  if (!isCurrentGame(sessionId)) {
    return;
  }

  // =====================================
  // 次のプレイヤーを取得
  // =====================================

  const next = getNextActivePlayer(player.id);

  if (!next) {
    return;
  }

  // =====================================
  // カード移動アニメーション
  // =====================================


const moved = await animateCardMove(
  player.id,
  card,
  "pass",
  next.id
);

if (!moved || !isCurrentGame(sessionId)) {
  return;
}


  // =====================================
  // 渡すプレイヤーの手札から削除
  // =====================================

  player.hand = player.hand.filter(
    item => item.id !== card.id
  );

  // =====================================
  // 受け取るプレイヤーの手札に追加
  // =====================================

  next.hand.push(card);

  
// 自分がカードを受け取った場合のみ強調表示
if (next.id === 0) {

  highlightNewHandCards([card]);

}


  // =====================================
  // 脱落判定
  // =====================================

  updateEliminations();

  // =====================================
  // 表示更新
  // =====================================

  renderAll();
}



// ========================================
// 参加中プレイヤー
// ========================================

function getNextActivePlayer(id) {

  for (let step = 1; step < playerCount; step++) {

    const index = (id + step) % playerCount;

    if (!players[index].eliminated) {
      return players[index];
    }
  }

  return null;
}

function getPreviousActivePlayer(id) {

  for (let step = 1; step < playerCount; step++) {

    const index =
      (id - step + playerCount) % playerCount;

    if (!players[index].eliminated) {
      return players[index];
    }
  }

  return null;
}

// ========================================
// 脱落・ターン終了
// ========================================


function updateEliminations() {

  let changed = false;

  players.forEach(player => {

    if (
      !player.eliminated &&
      player.hand.length === 0
    ) {

      player.eliminated = true;
      changed = true;

    }

  });

  if (changed) {
    renderPlayers();
  }

  return changed;
}




function finishTurn() {

  if (gameOver) {
    return;
  }

  updateEliminations();

  if (checkGameEnd()) {
    return;
  }

  // 次の手番へ
  advanceTurn();
}


function advanceTurn() {

  if (gameOver) return;

  for (let step = 1; step <= playerCount; step++) {

    const index =
      (currentPlayerIndex + step) % playerCount;

    if (!players[index].eliminated) {

      currentPlayerIndex = index;
      startTurn();
      return;
    }
  }

  checkGameEnd();
}

// ========================================
// 終了判定
// ========================================



function checkGameEnd() {

  if (gameOver) {
    return true;
  }

  // 12種類の干支がそろったか
  const zodiacComplete = ZODIACS.every(
    zodiac => field[zodiac].length > 0
  );

  // 脱落していないプレイヤー
  const activePlayers = players.filter(
    player => !player.eliminated
  );

  if (
    zodiacComplete ||
    activePlayers.length <= 1
  ) {

    gameOver = true;
    busy = false;
    turnProcessing = false;

    // 最終盤面を描画
    renderAll();

    // 現在のゲーム番号を保存
    const sessionId = gameSessionId;

    // 3秒間、終了時の盤面を表示
    setTimeout(() => {

      // 別のゲームが始まっていたら表示しない
      if (sessionId !== gameSessionId) {
        return;
      }

      // ゲーム画面が非表示なら表示しない
      if ($("game-screen").classList.contains("hidden")) {
        return;
      }

      showResult();

    }, 3000);

    return true;
  }

  return false;
}



// ========================================
// 勝者決定
// ========================================

function getWinner() {

  const scores = players.map(player => ({
    player,
    score: calculateScore(player.color)
  }));

  const maxScore = Math.max(
    ...scores.map(item => item.score)
  );

  const tied = scores.filter(
    item => item.score === maxScore
  );

  if (tied.length === 1) {
    return tied[0].player;
  }

  // 子から亥の順にタイブレーク
  for (const zodiac of ZODIACS) {

    const pile = field[zodiac];

    if (!pile.length) continue;

    const top = pile[pile.length - 1];

    const winner = tied.find(
      item => item.player.color === top.color
    );

    if (winner) {
      return winner.player;
    }
  }

  return tied[0].player;
}

// ========================================
// 結果画面
// ========================================



function showResult() {

  // 重複表示を防止
  $("result-overlay")?.remove();
  $("return-result-button")?.remove();

  const winner = getWinner();

  // =====================================
  // リザルト画面
  // =====================================

  const overlay = document.createElement("div");
  overlay.id = "result-overlay";

  const panel = document.createElement("div");
  panel.className = "result-panel";

  const title = document.createElement("h2");
  title.textContent = "ゲーム終了";

  const winnerText = document.createElement("h3");
  winnerText.textContent =
    `勝者：${winner.name}（${winner.color}）`;

  panel.append(title, winnerText);

  // =====================================
  // プレイヤーの得点
  // =====================================

  players.forEach(player => {

    const row = document.createElement("div");
    row.className = "result-row";

    if (player.id === winner.id) {
      row.classList.add("winner");
    }

    const name = document.createElement("span");
    name.textContent =
      `${player.name}（${player.color}）`;

    const score = document.createElement("span");
    score.textContent =
      `${calculateScore(player.color)}点`;

    row.append(name, score);
    panel.appendChild(row);

  });

  // =====================================
  // 盤面を見る
  // =====================================

  const viewBoard = document.createElement("button");
  viewBoard.className = "main-button";
  viewBoard.textContent = "場を見る";

  panel.appendChild(viewBoard);

  // =====================================
  // もう一度遊ぶ
  // =====================================

  const restart = document.createElement("button");
  restart.className = "main-button";
  restart.textContent = "もう一度遊ぶ";

  panel.appendChild(restart);

  // =====================================
  // ホーム画面に戻る
  // =====================================

  const home = document.createElement("button");
  home.className = "main-button";
  home.textContent = "ホーム画面に戻る";

  panel.appendChild(home);

  // =====================================
  // リザルトに戻るボタン
  // =====================================

  const returnButton = document.createElement("button");

  returnButton.id = "return-result-button";
  returnButton.type = "button";
  returnButton.textContent = "ゲーム結果画面に戻る";
  returnButton.classList.add("hidden");

  $("game-board").appendChild(returnButton);

  // =====================================
  // 盤面確認
  // =====================================

  viewBoard.addEventListener("click", () => {

    overlay.classList.add("hidden");
    returnButton.classList.remove("hidden");

  });

  // =====================================
  // リザルトへ戻る
  // =====================================

  returnButton.addEventListener("click", () => {

    returnButton.classList.add("hidden");
    overlay.classList.remove("hidden");

  });

  // =====================================
  // もう一度遊ぶ
  // =====================================

  restart.addEventListener("click", () => {

    returnButton.remove();
    overlay.remove();

    startGame();

  });

  // =====================================
  // ホーム画面へ戻る
  // =====================================

  home.addEventListener("click", () => {

    // 現在の対戦を終了
    gameOver = true;
    busy = false;
    turnProcessing = false;

    // 以前のゲームの非同期処理を無効化
    gameSessionId++;

    clearGameAnimations();

    if (closeActiveReveal) {
      closeActiveReveal();
    }

    // リザルト関連の表示を削除
    returnButton.remove();
    overlay.remove();

    // ゲーム画面を閉じる
    $("game-screen").classList.add("hidden");

    // ホーム画面を表示
    $("setup-screen").classList.remove("hidden");

    // 画面レイアウトを更新
    resizeSetup();

  });

  // =====================================
  // リザルト表示
  // =====================================

  overlay.appendChild(panel);
  $("app").appendChild(overlay);

}


// ========================================
// 手札公開
// ========================================


async function revealCpuHand(player) {

  await showRevealModal(
    `${player.name}の手札公開`,
    "出せるカードがないため、手札を公開します。",
    player.hand
  );
}


/* ========================================
   プレイヤーの表示位置
======================================== */

function getPlayerPanelId(playerId) {

  if (playerId === 0) {
    return "my-hand";
  }

  if (playerCount === 2) {
    return "cpu-top";
  }

  if (playerCount === 3) {

    return playerId === 1
      ? "cpu-left"
      : "cpu-right";
  }

  if (playerId === 1) {
    return "cpu-left";
  }

  if (playerId === 2) {
    return "cpu-top";
  }

  return "cpu-right";
}


/* ========================================
   要素の画面上の中心座標
======================================== */

function getElementCenter(element) {

  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}



/* =====================================
   移動カードの向きを補正
===================================== */

function adjustMovingCardRotation(moving) {

  const isPortrait =
    window.innerHeight > window.innerWidth;

  if (!isPortrait) {
    return;
  }

  // カード本体だけを回転させる
  // 移動用要素の transform は変更しない

  const cardContent = moving.firstElementChild;

  if (!cardContent) {
    return;
  }

  cardContent.style.transform = "rotate(90deg)";
  cardContent.style.transformOrigin = "center center";
}


/* ========================================
   カード移動アニメーション
======================================== */


async function animateCardMove(
  playerId,
  card,
  type,
  targetId = null
) {

  // =====================================
  // 現在のゲーム番号を保存
  // =====================================

  const sessionId = gameSessionId;

  if (!isCurrentGame(sessionId)) {
    return false;
  }

  // =====================================
  // 1. 移動元を取得
  // =====================================

  let sourceElement;

  if (playerId === 0) {

    sourceElement = document.querySelector(
      `.hand-card[data-card-id="${card.id}"]`
    );

    if (!sourceElement) {
      sourceElement = $("my-hand");
    }

  } else {

    sourceElement = $(
      getPlayerPanelId(playerId)
    );
  }

  // =====================================
  // 2. 移動先を取得
  // =====================================

  let targetElement;

  if (type === "field") {

    if (card.zodiac === "猫") {

      targetElement = $("cat-cards");

    } else {

      targetElement = document.querySelector(
        `[data-zodiac="${card.zodiac}"]`
      );
    }

  } else if (type === "pass") {

    targetElement = $(
      getPlayerPanelId(targetId)
    );
  }

  if (!sourceElement || !targetElement) {
    return false;
  }

  // =====================================
  // 3. 座標を取得
  // =====================================

  const start = getElementCenter(
    sourceElement
  );

  const end = getElementCenter(
    targetElement
  );

  if (!start || !end) {
    return false;
  }

  // =====================================
  // 4. 移動カードを作成
  // =====================================

  const moving = document.createElement("div");

  moving.className = "moving-card";

  if (type === "pass") {

    const back = document.createElement("div");

    back.className = "card-back";

    moving.appendChild(back);

  } else {

    const face = createCardElement(card);

    face.style.width = "100%";
    face.style.height = "100%";

    moving.appendChild(face);
  }

  // =====================================
  // 5. 初期位置
  // =====================================

  moving.style.left = `${start.x - 30}px`;
  moving.style.top = `${start.y - 42}px`;

document.body.appendChild(moving);

// スマホ縦持ち時のカード向きを補正
adjustMovingCardRotation(moving);

activeAnimations.add(moving);

  // =====================================
  // 6. 移動距離
  // =====================================

  const moveX = end.x - start.x;
  const moveY = end.y - start.y;

  // =====================================
  // 7. 速度
  // =====================================

  let duration = 500;

  if (cpuSpeed === "fast") {
    duration = 250;
  }

  if (cpuSpeed === "slow") {
    duration = 850;
  }

  // =====================================
  // 8. アニメーション
  // =====================================

  let animation;

  try {

    animation = moving.animate(
      [
        {
          transform:
            "translate(0px, 0px) scale(1)",
          opacity: 1
        },
        {
          transform:
            `translate(${moveX / 2}px, ` +
            `${moveY / 2 - 35}px) scale(1.12)`,
          opacity: 1,
          offset: 0.5
        },
        {
          transform:
            `translate(${moveX}px, ` +
            `${moveY}px) scale(0.9)`,
          opacity: 1
        }
      ],
      {
        duration,
        easing: "ease-in-out",
        fill: "forwards"
      }
    );

    await animation.finished;

  } catch (error) {

    // ゲーム切り替えによるキャンセルなど
    return false;

  } finally {

    // 正常終了・キャンセルの両方で片付ける
    moving.remove();

    activeAnimations.delete(moving);
  }

  // =====================================
  // 9. ゲーム番号の最終確認
  // =====================================

  if (!isCurrentGame(sessionId)) {
    return false;
  }

  return true;
}


// ========================================
// 操作ボタン
// ========================================

function updateButtons() {

  const myTurn =
    !gameOver &&
    currentPlayerIndex === 0 &&
    !busy &&
    !players[0].eliminated;

  $("play-button").disabled =
    !myTurn || phase !== "play";

  $("pass-button").disabled =
    !myTurn || phase !== "pass";
}

// ========================================
// 表示更新
// ========================================

function renderAll() {

  renderPlayers();
  renderField();
  renderHand();
  updateSortButtons();
  updateButtons();
}

function showMessage(message) {
  $("game-message").textContent = message;
}


// ========================================
// 並び替え
// ========================================

$("sort-zodiac").addEventListener("click", () => {

  handSort = "zodiac";
  updateSortButtons();
  renderHand();
});

$("sort-color").addEventListener("click", () => {

  handSort = "color";
  updateSortButtons();
  renderHand();
});

function updateSortButtons() {

  $("sort-zodiac").classList.toggle(
    "active",
    handSort === "zodiac"
  );

  $("sort-color").classList.toggle(
    "active",
    handSort === "color"
  );
}

// ========================================
// CPU速度
// ========================================

$("cpu-speed").addEventListener("change", event => {
  cpuSpeed = event.target.value;
});

// ========================================
// 戻る
// ========================================

$("back-button").addEventListener("click", () => {

    stopCurrentGame();

  if (!confirm("対戦を終了して戻りますか？")) {
    return;
  }

  // 実行中の非同期処理を止める処理は
  // 次のSTEPで強化します。
  gameOver = true;

// ゲーム結果画面を削除
$("result-overlay")?.remove();

// ゲーム結果画面に戻るボタンも削除
$("return-result-button")?.remove();

// 色予想画面が残っていた場合も削除
$("cpu-color-picker")?.remove();

// ゲーム画面を閉じる
$("game-screen").classList.add("hidden");

// ホーム画面を表示
$("setup-screen").classList.remove("hidden");
});

// ========================================
// 画面サイズ
// ========================================



/* ========================================
   全画面共通の回転・縮小処理
   基準サイズ：1280 × 720
======================================== */

function resizeApp() {

  const app = document.getElementById("app");

  if (!app) {
    return;
  }

  const viewport = window.visualViewport;

  const width = viewport
    ? viewport.width
    : window.innerWidth;

  const height = viewport
    ? viewport.height
    : window.innerHeight;

  if (width <= 0 || height <= 0) {
    return;
  }

  const baseWidth = 1280;
  const baseHeight = 720;

  const portrait = height > width;

  const scale = portrait
    ? Math.min(
        width / baseHeight,
        height / baseWidth
      )
    : Math.min(
        width / baseWidth,
        height / baseHeight
      );

  app.style.width = `${baseWidth}px`;
  app.style.height = `${baseHeight}px`;

  app.style.transformOrigin = "top left";

  if (portrait) {

    const displayWidth = baseHeight * scale;
    const displayHeight = baseWidth * scale;

    const x = (width - displayWidth) / 2;
    const y = (height - displayHeight) / 2;

    app.style.transform =
      `translate(${x + displayWidth}px, ${y}px) ` +
      `rotate(90deg) scale(${scale})`;

  } else {

    const displayWidth = baseWidth * scale;
    const displayHeight = baseHeight * scale;

    const x = (width - displayWidth) / 2;
    const y = (height - displayHeight) / 2;

    app.style.transform =
      `translate(${x}px, ${y}px) scale(${scale})`;

  }

}

// 既存の呼び出しとの互換性
function resizeGame() {
  resizeApp();
}


function showRevealModal(title, description, cards) {

  const sessionId = gameSessionId;

  return new Promise(resolve => {

    // =====================================
    // 現在のゲームか確認
    // =====================================

    if (!isCurrentGame(sessionId)) {
      resolve(false);
      return;
    }

    // =====================================
    // 画面の要素を取得
    // =====================================

    const overlay = $("reveal-overlay");
    const cardContainer = $("reveal-cards");
    const closeButton = $("reveal-close");

    // =====================================
    // タイトルと説明
    // =====================================

    $("reveal-title").textContent = title;
    $("reveal-description").textContent = description;

    // =====================================
    // 公開するカードを表示
    // =====================================

    cardContainer.replaceChildren();

    cards.forEach(card => {

      const element = createCardElement(
        card,
        "reveal-card"
      );

      cardContainer.appendChild(element);
    });

    overlay.classList.remove("hidden");

    // =====================================
    // 閉じる処理
    // =====================================

    let closed = false;

    const closeReveal = () => {

      // 二重実行を防止
      if (closed) {
        return;
      }

      closed = true;

      overlay.classList.add("hidden");

      closeButton.onclick = null;

      // 別の公開画面の処理を消さない
      if (closeActiveReveal === closeReveal) {
        closeActiveReveal = null;
      }

      // 正常終了ならtrue
      // ゲームが切り替わっていればfalse
      resolve(isCurrentGame(sessionId));
    };

    // =====================================
    // 閉じる関数を登録
    // =====================================

    closeActiveReveal = closeReveal;

    closeButton.onclick = closeReveal;

  });
}




async function showSpecialEffect(message, duration = 900) {

  // =====================================
  // 現在のゲーム番号を保存
  // =====================================

  const sessionId = gameSessionId;

  if (!isCurrentGame(sessionId)) {
    return;
  }

  // =====================================
  // メッセージ要素を作成
  // =====================================

  const element = document.createElement("div");

  element.className =
    "special-effect-message show";

  element.textContent = message;

  $("app").appendChild(element);

  // ゲーム終了時に削除できるよう登録
  activeAnimations.add(element);

  // =====================================
  // メッセージ表示
  // =====================================

  try {

    await sleep(duration);

  } finally {

    // 表示終了・ゲーム切り替え後に削除
    element.remove();

    activeAnimations.delete(element);
  }

  // =====================================
  // ゲーム番号の確認
  // =====================================

  if (!isCurrentGame(sessionId)) {
    return;
  }
}



async function highlightZodiacPile(zodiac) {

  // =====================================
  // 現在のゲーム番号を保存
  // =====================================

  const sessionId = gameSessionId;

  if (!isCurrentGame(sessionId)) {
    return;
  }

  // =====================================
  // 対象の山を取得
  // =====================================

  const slot = document.querySelector(
    `[data-zodiac="${zodiac}"]`
  );

  if (!slot) {
    return;
  }

  // =====================================
  // 強調表示を開始
  // =====================================

  slot.classList.add("special-highlight");

  try {

    // 0.6秒間光らせる
    await sleep(600);

  } finally {

    // ゲームが切り替わっても
    // この演出の強調表示を解除する
    slot.classList.remove("special-highlight");

  }

  // =====================================
  // ゲーム番号の確認
  // =====================================

  if (!isCurrentGame(sessionId)) {
    return;
  }
}



/* ========================================
   猫専用：子カード公開画面
======================================== */


function showCatRevealModal(transfers) {

  const sessionId = gameSessionId;

  return new Promise(resolve => {

    // =====================================
    // 現在のゲームか確認
    // =====================================

    if (!isCurrentGame(sessionId)) {
      resolve(false);
      return;
    }

    // =====================================
    // 画面の要素を取得
    // =====================================

    const overlay = $("reveal-overlay");
    const container = $("reveal-cards");
    const closeButton = $("reveal-close");

    // =====================================
    // タイトルと説明
    // =====================================

    $("reveal-title").textContent =
      "猫（ねこ）の効果";

    $("reveal-description").textContent =
      "各プレイヤーの子（ね）を公開します。"
      + "カードは通常とは逆方向に渡されます。";

    container.replaceChildren();

    // =====================================
    // 公開カードの表示
    // =====================================

    if (transfers.length === 0) {

      const empty = document.createElement("p");

      empty.textContent =
        "子（ね）を持っているプレイヤーはいません。";

      container.appendChild(empty);

    } else {

      transfers.forEach(transfer => {

        const group = document.createElement("div");

        group.className = "cat-reveal-group";

        const title = document.createElement("div");

        title.className = "cat-reveal-title";

        title.textContent =
          `${transfer.from.name} → ${transfer.to.name}`
          + `（${transfer.cards.length}枚）`;

        const cards = document.createElement("div");

        cards.className = "cat-reveal-card-list";

        transfer.cards.forEach(card => {

          const element = createCardElement(
            card,
            "reveal-card"
          );

          cards.appendChild(element);
        });

        group.append(title, cards);

        container.appendChild(group);
      });
    }

    // =====================================
    // 公開画面を表示
    // =====================================

    overlay.classList.remove("hidden");

    // =====================================
    // 閉じる処理
    // =====================================

    let closed = false;

    const closeReveal = () => {

      // 二重実行防止
      if (closed) {
        return;
      }

      closed = true;

      overlay.classList.add("hidden");

      // 自分のイベントだけ解除
      if (closeButton.onclick === closeReveal) {
        closeButton.onclick = null;
      }

      // 自分が登録した終了処理だけ解除
      if (closeActiveReveal === closeReveal) {
        closeActiveReveal = null;
      }

      // 同じゲームならtrue
      // 別のゲームならfalse
      resolve(isCurrentGame(sessionId));
    };

    // =====================================
    // 強制終了用の関数を登録
    // =====================================

    closeActiveReveal = closeReveal;

    // 閉じるボタン
    closeButton.onclick = closeReveal;

  });
}


/* ========================================
   猫：子カード移動アニメーション
======================================== */


async function animateCatTransfers(transfers) {

  // =====================================
  // 現在のゲーム番号
  // =====================================

  const sessionId = gameSessionId;

  if (!isCurrentGame(sessionId)) {
    return false;
  }

  if (transfers.length === 0) {
    return true;
  }

  // =====================================
  // アニメーション速度
  // =====================================

  const duration =
    cpuSpeed === "fast" ? 350 :
    cpuSpeed === "slow" ? 1500 : 850;

  const animations = [];

  // =====================================
  // 全プレイヤーのカード移動を作成
  // =====================================

  transfers.forEach(transfer => {

    const sourceElement = $(
      getPlayerPanelId(transfer.from.id)
    );

    const targetElement = $(
      getPlayerPanelId(transfer.to.id)
    );

    if (!sourceElement || !targetElement) {
      return;
    }

    const start = getElementCenter(sourceElement);
    const end = getElementCenter(targetElement);

    if (!start || !end) {
      return;
    }

    transfer.cards.forEach((card, index) => {

      const moving = document.createElement("div");

      moving.className = "moving-card";

      const face = createCardElement(card);

      face.style.width = "100%";
      face.style.height = "100%";

      moving.appendChild(face);

      const offset = index * 12;

      moving.style.left =
        `${start.x - 30 + offset}px`;

      moving.style.top =
        `${start.y - 42 - offset}px`;

document.body.appendChild(moving);

// 猫の効果による移動カードも向きを補正
adjustMovingCardRotation(moving);

activeAnimations.add(moving);

      const dx = end.x - start.x;
      const dy = end.y - start.y;

      // =================================
      // 移動アニメーション
      // =================================

      const animation = moving.animate(
        [
          {
            transform: "translate(0px, 0px)",
            opacity: 1
          },
          {
            transform:
              `translate(${dx / 2}px, ` +
              `${dy / 2 - 45}px) scale(1.15)`,
            opacity: 1,
            offset: 0.5
          },
          {
            transform:
              `translate(${dx}px, ${dy}px) scale(0.85)`,
            opacity: 1
          }
        ],
        {
          duration,
          easing: "ease-in-out",
          fill: "forwards"
        }
      );

      // =================================
      // 完了・中断時の後片付け
      // =================================

      const promise = animation.finished
        .then(() => true)
        .catch(() => false)
        .finally(() => {

          moving.remove();

          activeAnimations.delete(moving);

        });

      animations.push(promise);

    });
  });

  // =====================================
  // 全カードの移動完了を待つ
  // =====================================

  const results = await Promise.all(animations);

  // =====================================
  // ゲーム切り替え確認
  // =====================================

  if (!isCurrentGame(sessionId)) {
    return false;
  }

  // 1つでも中断されていたら失敗
  if (results.some(result => !result)) {
    return false;
  }

  return true;
}




/* ========================================
   アニメーションの後片付け
======================================== */

function clearGameAnimations() {

  activeAnimations.forEach(element => {

    element.getAnimations().forEach(
      animation => animation.cancel()
    );

    element.remove();
  });

  activeAnimations.clear();

  document.querySelectorAll(
    ".special-effect-message"
  ).forEach(element => {
    element.remove();
  });
}

/* ========================================
   操作可能状態の確認
======================================== */

function canHumanOperate() {

  if (gameOver) {
    return false;
  }

  if (busy || turnProcessing) {
    return false;
  }

  const currentPlayer =
    players[currentPlayerIndex];

  if (!currentPlayer) {
    return false;
  }

  return (
    currentPlayer.id === 0 &&
    !currentPlayer.eliminated
  );
}


/* ========================================
   ゲーム終了・タイトルへ戻る処理
======================================== */

function stopCurrentGame() {

  // 古い非同期処理を無効化
  gameSessionId++;
  newHandCards.clear();

  gameOver = true;

  // アニメーションを終了
  clearGameAnimations();

  // 公開画面を閉じる
  if (closeActiveReveal) {
    closeActiveReveal();
  }

  const overlay = $("reveal-overlay");

  if (overlay) {
    overlay.classList.add("hidden");
  }

  busy = false;
  turnProcessing = false;

  selectedCardId = null;
}



function resizeSetup() {
  resizeApp();
}



function updateColorCounts() {

  const counts = {
    "赤": 0,
    "青": 0,
    "黄": 0,
    "緑": 0
  };

  ZODIACS.forEach(zodiac => {

    const pile = field[zodiac];

    if (!pile || pile.length === 0) {
      return;
    }

    // 山の一番上のカードだけを集計
    const topCard = pile[pile.length - 1];

    if (counts[topCard.color] !== undefined) {
      counts[topCard.color]++;
    }
  });

  $("count-red").textContent = counts["赤"];
  $("count-blue").textContent = counts["青"];
  $("count-yellow").textContent = counts["黄"];
  $("count-green").textContent = counts["緑"];
}


/* =====================================
   特殊カード説明画面
===================================== */

function openSpecialRules() {

  const overlay = $("special-rules-overlay");

  if (!overlay) {
    return;
  }

  overlay.classList.remove("hidden");
}


function closeSpecialRules() {

  const overlay = $("special-rules-overlay");

  if (!overlay) {
    return;
  }

  overlay.classList.add("hidden");
}


/* =====================================
   ボタンのイベント登録
===================================== */

$("special-rules-button").addEventListener(
  "click",
  openSpecialRules
);

$("special-rules-close").addEventListener(
  "click",
  closeSpecialRules
);


/* =====================================
   ルール説明画面
===================================== */

function openRules() {

  $("rules-overlay").classList.remove("hidden");

}

function closeRules() {

  $("rules-overlay").classList.add("hidden");

}

$("rules-button").addEventListener(
  "click",
  openRules
);

$("rules-close").addEventListener(
  "click",
  closeRules
);


/* =====================================
   iPhone ホーム画面対応
   画面サイズ変更をまとめて処理
===================================== */

let layoutUpdateFrame = null;
let layoutUpdateTimer = null;


function updateScreenLayout() {

  if (layoutUpdateFrame !== null) {
    cancelAnimationFrame(layoutUpdateFrame);
  }

  layoutUpdateFrame = requestAnimationFrame(() => {

    layoutUpdateFrame = null;

    resizeApp();

  });

}


function scheduleScreenLayout() {

  // =====================================
  // 回転直後に更新
  // =====================================

  resetPagePosition();

  updateScreenLayout();

  // =====================================
  // 前回の予約を取り消す
  // =====================================

  clearTimeout(layoutUpdateTimer);

  // =====================================
  // 画面回転後のサイズ変化に対応
  // =====================================

  layoutUpdateTimer = setTimeout(() => {

    resetPagePosition();

    updateScreenLayout();

    // =====================================
    // 最終的な表示領域で再計算
    // =====================================

    requestAnimationFrame(() => {

      resetPagePosition();

      updateScreenLayout();

    });

  }, 500);

}

window.addEventListener(
  "resize",
  scheduleScreenLayout
);

window.addEventListener(
  "orientationchange",
  scheduleScreenLayout
);

window.visualViewport?.addEventListener(
  "resize",
  scheduleScreenLayout
);

window.addEventListener(
  "pageshow",
  scheduleScreenLayout
);

// 初回表示
scheduleScreenLayout();

/* =====================================
   ルール説明のスクロール案内
===================================== */

function updateRulesScrollHint() {

  const content =
    document.querySelector(".rules-content");

  const hint =
    document.querySelector(".rules-scroll-hint");

  if (!content || !hint) {
    return;
  }

  // 現在のスクロール位置
  const scrollTop = content.scrollTop;

  // スクロール可能な最大位置
  const maxScroll =
    content.scrollHeight - content.clientHeight;

  // 一番下まで到達したか判定
  const isBottom =
    maxScroll <= 0 ||
    scrollTop >= maxScroll - 5;

  // 一番下なら非表示
  hint.classList.toggle(
    "hidden",
    isBottom
  );

}


// =====================================
// スクロール時に判定
// =====================================

document.querySelector(".rules-content")
  ?.addEventListener(
    "scroll",
    updateRulesScrollHint,
    { passive: true }
  );


// =====================================
// ルール画面を開いたときにも判定
// =====================================

document.getElementById("rules-button")
  ?.addEventListener("click", () => {

    requestAnimationFrame(() => {
      updateRulesScrollHint();
    });

  });

  /* =====================================
   Service Worker 登録
===================================== */

if ("serviceWorker" in navigator) {

  window.addEventListener("load", async () => {

    try {

      const registration =
        await navigator.serviceWorker.register(
          "./sw.js"
        );

      console.log(
        "Service Worker 登録成功",
        registration.scope
      );

    } catch (error) {

      console.error(
        "Service Worker 登録失敗",
        error
      );

    }

  });

}


/* =====================================
   iPhone 画面位置の補正
===================================== */

function resetPagePosition() {

  window.scrollTo(0, 0);

  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

}

/* ========================================
   CPU速度の表示更新
======================================== */

const cpuSpeedSelect =
  document.getElementById("cpu-speed");

const cpuSpeedLabel =
  document.querySelector(".speed-control label");

function updateCpuSpeedLabel() {

  const selectedText =
    cpuSpeedSelect.options[
      cpuSpeedSelect.selectedIndex
    ].textContent;

  cpuSpeedLabel.textContent =
    "CPU速度：" + selectedText;

}

cpuSpeedSelect.addEventListener(
  "change",
  updateCpuSpeedLabel
);

updateCpuSpeedLabel();



/* ========================================
   干支のはなし
======================================== */

const etoStoryPages = [

  // =====================================
  // 1ページ目：十二支の説明
  // =====================================

  {
    title: "十二支とは？",
    text: `
      <p>
        十二支は、子・丑・寅・卯・辰・巳・
        午・未・申・酉・戌・亥の12種類です。
      </p>

      <p>
        日本では、それぞれに動物が
        当てはめられています。
      </p>

      <h3>十二支の動物たち</h3>


<div class="eto-animal-list">

  <span><strong>子（ね）</strong>ネズミ</span>
  <span><strong>丑（うし）</strong>ウシ</span>
  <span><strong>寅（とら）</strong>トラ</span>

  <span><strong>卯（う）</strong>ウサギ</span>
  <span><strong>辰（たつ）</strong>龍</span>
  <span><strong>巳（み）</strong>ヘビ</span>

  <span><strong>午（うま）</strong>ウマ</span>
  <span><strong>未（ひつじ）</strong>ヒツジ</span>
  <span><strong>申（さる）</strong>サル</span>

  <span><strong>酉（とり）</strong>ニワトリ</span>
  <span><strong>戌（いぬ）</strong>イヌ</span>
  <span><strong>亥（い）</strong>イノシシ</span>

</div>


      <p>
        どうして、この順番になったのでしょうか？
      </p>

      <p>
        動物たちにまつわる昔話を
        読んでみましょう。
      </p>
    `
  },

  // =====================================
  // 2ページ目：神様のお知らせ
  // =====================================

  {
    title: "神様からのお知らせ",
    text: `
      <p>
        むかしむかし、神様が動物たちを
        集めて言いました。
      </p>

      <p>
        「新しい年の最初の日、
        わしのところへ来なさい。
        早く着いた十二匹を、
        一年ずつその年の代表にしてあげよう」
      </p>

      <p>
        動物たちは大喜び。
      </p>

      <p>
        誰が一番になるのか、
        みんな張り切っていました。
      </p>
    `
  },

  // =====================================
  // 3ページ目：ネズミと牛
  // =====================================

  {
    title: "ウシの頭に乗ったネズミ",
    text: `
      <p>
        ウシは、自分が歩くのが遅いことを
        知っていたので、
        まだ暗いうちから出発しました。
      </p>

      <p>
        それを見ていたネズミは、
        こっそりウシの頭に乗りました。
      </p>

      <p>
        ウシは一生懸命歩き、
        とうとう神様の門の前に
        たどり着きました。
      </p>

      <p>
        ところが、門が開いたその瞬間！
      </p>

      <p>
        ネズミがウシの頭から
        ぴょんと飛び降り、
        真っ先に神様のところへ
        駆け込みました。
      </p>

      <p>
        こうして、
        <strong>一番はネズミ、
        二番はウシ</strong>になったのです。
      </p>
    `
  },

  // =====================================
  // 4ページ目：龍とヘビ
  // =====================================

  {
    title: "龍に道を譲ったヘビ",
    text: `
      <p>
        続いて、トラとウサギが
        やって来ました。
      </p>

      <p>
        そのあとを、空を飛ぶ龍と
        地面を進むヘビが追いかけていました。
      </p>

      <p>
        ヘビは龍が近づいてくるのを見ると、
        道を空けて言いました。
      </p>

      <p>
        「龍さん、お先にどうぞ」
      </p>

      <p>
        龍は「ありがとう」とお礼を言って、
        先に神様のところへ向かいました。
      </p>

      <p>
        こうして、
        <strong>五番は龍、
        六番はヘビ</strong>になりました。
      </p>
    `
  },

  // =====================================
  // 5ページ目：サル・イヌ・ニワトリ
  // =====================================

  {
    title: "サルとイヌの大げんか",
    text: `
      <p>
        そのころ、サルとイヌは、
        どちらが先に進むかで
        大げんかをしていました。
      </p>

      <p>
        「おれが先だ！」
      </p>

      <p>
        「いや、ぼくが先だ！」
      </p>

      <p>
        二匹は言い争い、
        とうとう足を止めてしまいました。
      </p>

      <p>
        そこへニワトリがやって来ました。
      </p>

      <p>
        「けんかしている場合じゃないよ！
        早く行かないと間に合わないよ！」
      </p>

      <p>
        ニワトリは二匹の間に入り、
        けんかを止めました。
      </p>

      <p>
        三匹は再び走り出しましたが、
        その間にウマとヒツジが
        先へ進んでいました。
      </p>

      <p>
        こうして、
        <strong>九番はサル、
        十番はニワトリ、
        十一番はイヌ</strong>になりました。
      </p>
    `
  },

  // =====================================
  // 6ページ目：イノシシ
  // =====================================

  {
    title: "走りすぎたイノシシ",
    text: `
      <p>
        実は、誰よりも勢いよく走っていた
        動物がいました。
      </p>

      <p>
        それはイノシシです。
      </p>

      <p>
        「一番はおれだー！」
      </p>

      <p>
        イノシシはものすごい速さで
        神様の門へ向かいました。
      </p>

      <p>
        ところが、あまりに勢いがよすぎて、
        門の前を通り過ぎてしまったのです！
      </p>

      <p>
        「あれっ！？ 神様のところはどこだ！？」
      </p>

      <p>
        慌てて引き返したイノシシでしたが、
        その間にほかの動物たちが
        次々と到着していました。
      </p>

      <p>
        ようやく神様のところへ着いたときには、
        <strong>十二番目</strong>。
      </p>

      <p>
        こうしてイノシシは、
        十二支の最後になったのでした。
      </p>
    `
  },

  // =====================================
  // 7ページ目：猫
  // =====================================

  {
    title: "十三番目にやって来たネコ",
    text: `
      <p>
        神様が動物たちを集めたとき、
        ネコは大切なことを
        聞き逃してしまいました。
      </p>

      <p>
        「神様のところへ行くのは、
        いつだったかな？」
      </p>

      <p>
        困ったネコはネズミに尋ねました。
      </p>

      <p>
        するとネズミは、
        いたずらを思いつきました。
      </p>

      <p>
        「神様のところへ行くのは、
        二日目の朝だよ！」
      </p>

      <p>
        本当は新しい年の最初の日なのに、
        ネズミはわざと間違った日を教えたのです。
      </p>

      <p>
        何も知らないネコは、
        ネズミの言葉を信じて
        その日を待ちました。
      </p>

      <p>
        そして二日目の朝。
      </p>

      <p>
        「よーし、十二支の仲間になるぞ！」
      </p>

      <p>
        ネコは張り切って
        神様のところへ向かいました。
      </p>

      <p>
        ところが、到着すると、
        すでに十二匹の動物たちが
        並んでいました。
      </p>

      <p>
        「残念じゃが、十二支は
        昨日決まってしまったぞ」
      </p>

      <p>
        「ええっ！？ ネズミは
        今日だと言っていたのに！」
      </p>

      <p>
        ネコは十三番目にやって来たため、
        十二支に入ることができませんでした。
      </p>

      <p>
        しかも、ネズミは一番になっていました。
      </p>

      <p>
        「ネズミめ！ よくもだましたな！」
      </p>

      <p>
        怒ったネコは、
        ネズミを追いかけ始めました。
      </p>

      <p>
        こうして、ネコがネズミを
        追いかけるようになったと
        いわれています。
      </p>

      <p class="eto-story-ending">
        子・丑・寅・卯・辰・巳<br>
        午・未・申・酉・戌・亥
      </p>

      <p class="eto-story-ending">
        おしまい
      </p>
    `
  }

];


/* ========================================
   現在のページ
======================================== */

let etoStoryIndex = 0;


/* ========================================
   ページ表示
======================================== */

function renderEtoStory() {

  const page = etoStoryPages[etoStoryIndex];

  const content =
    document.getElementById("eto-story-content");

  content.innerHTML = `
    <h3>${page.title}</h3>
    ${page.text}
  `;

  // ページ番号
  document.getElementById("eto-story-page")
    .textContent =
      `${etoStoryIndex + 1} / ${etoStoryPages.length}`;

  // 前へボタン
  document.getElementById("eto-story-prev")
    .disabled = etoStoryIndex === 0;

  // 次へボタン
  const nextButton =
    document.getElementById("eto-story-next");

  nextButton.textContent =
    etoStoryIndex === etoStoryPages.length - 1
      ? "終わり"
      : "次へ";

  // ページを切り替えたら先頭へ
  content.scrollTop = 0;

}


/* ========================================
   干支のはなしを開く
======================================== */

document
  .getElementById("eto-story-button")
  .addEventListener("click", () => {

    etoStoryIndex = 0;

    renderEtoStory();

    document
      .getElementById("eto-story-overlay")
      .classList.remove("hidden");

  });


/* ========================================
   前へ
======================================== */

document
  .getElementById("eto-story-prev")
  .addEventListener("click", () => {

    if (etoStoryIndex > 0) {

      etoStoryIndex--;

      renderEtoStory();

    }

  });


/* ========================================
   次へ
======================================== */

document
  .getElementById("eto-story-next")
  .addEventListener("click", () => {

    if (
      etoStoryIndex <
      etoStoryPages.length - 1
    ) {

      etoStoryIndex++;

      renderEtoStory();

    } else {

      document
        .getElementById("eto-story-overlay")
        .classList.add("hidden");

    }

  });


/* ========================================
   閉じる
======================================== */

document
  .getElementById("eto-story-close")
  .addEventListener("click", () => {

    document
      .getElementById("eto-story-overlay")
      .classList.add("hidden");

  });
