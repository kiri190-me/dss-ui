import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * 스타일시트를 **읽어서** 대조하는 시험.
 *
 * 왜 이런 시험이 있나: 이 조각의 화면은 브라우저 없이 확인할 수 없지만,
 * 눈으로 못 잡는 대신 기계가 잡을 수 있는 종류의 사고가 셋 있다.
 *   1. 마크업이 쓰는 클래스에 규칙이 없다(오타 한 글자면 띠가 통째로
 *      민짜가 된다 — 라이트에서는 그럭저럭 읽혀 한참 뒤에 발견된다).
 *   2. 다크에만 값이 빠진다(그 색만 라이트 값을 물려받아 글자가 바탕에
 *      묻는다. 「다크가 라이트와 같은 품질」이 깨지는 가장 흔한 길이다).
 *   3. 선언하지 않은 변수를 쓴다(값이 비어 색이 기본값으로 떨어진다).
 * 셋 다 파일 두 개를 맞대 보면 알 수 있는 것이라 시험으로 못 박는다.
 */

/**
 * 주석을 떼고 본다. 이 저장소는 주석에 「사이트는 `.dss-menu { … }` 한 줄로
 * 덮는다」 같은 예시를 적어 두는데, 그것까지 규칙으로 세면 시험이 설명문을
 * 읽고 판정하게 된다.
 */
const CSS = readFileSync(
  fileURLToPath(new URL("./service-menu.css", import.meta.url)),
  "utf8"
).replace(/\/\*[\s\S]*?\*\//g, "");

const TSX = readFileSync(fileURLToPath(new URL("./ServiceMenuBar.tsx", import.meta.url)), "utf8");

/** 선택자 뒤에 오는 한 블록의 속내를 뽑는다(이 파일에는 중첩 블록이 없다). */
function blockAfter(pattern: RegExp): string {
  const match = pattern.exec(CSS);
  assert.ok(match, `CSS 에서 ${pattern} 를 못 찾았다`);
  return match[1];
}

/** 블록 안에서 정의하는 --dss-menu-* 변수 이름들. */
function declaredVars(block: string): Set<string> {
  return new Set([...block.matchAll(/(--dss-menu-[a-z-]+)\s*:/g)].map((m) => m[1]));
}

const LIGHT = blockAfter(/\.dss-menu\s*\{([^}]*)\}/);
const DARK = blockAfter(/\.dark \.dss-menu,[\s\S]*?\{([^}]*)\}/);
const SYSTEM_DARK = blockAfter(
  /@media \(prefers-color-scheme: dark\)\s*\{\s*\.dss-menu\[data-color-scheme="system"\]\s*\{([^}]*)\}/
);
const FORCED_LIGHT = blockAfter(/\.dss-menu\[data-color-scheme="light"\]\s*\{([^}]*)\}/);

/**
 * 밝기와 상관없는 값. 테마별로 달라서는 안 되므로 아래 대조에서 뺀다
 * (노치 인셋은 색이 아니라 배치다).
 */
const THEME_NEUTRAL = new Set(["--dss-menu-inset-top"]);

function themedVars(block: string): Set<string> {
  return new Set([...declaredVars(block)].filter((name) => !THEME_NEUTRAL.has(name)));
}

test("마크업이 쓰는 클래스에는 전부 규칙이 있다", () => {
  const used = new Set([...TSX.matchAll(/"(dss-menu(?:__[a-z]+)?)[ "]/g)].map((m) => m[1]));

  assert.ok(used.size >= 5, `마크업에서 클래스를 못 찾았다(${[...used].join(", ")})`);
  for (const className of used) {
    assert.ok(
      CSS.includes(`.${className}`),
      `.${className} 규칙이 CSS 에 없다 — 그 부분만 민짜로 뜬다`
    );
  }
});

test("CSS 에만 있고 아무도 안 쓰는 클래스는 없다", () => {
  const defined = new Set(
    [...CSS.matchAll(/\.(dss-menu__[a-z]+)/g)].map((m) => m[1])
  );

  for (const className of defined) {
    assert.ok(TSX.includes(`"${className}"`), `.${className} 을 마크업이 쓰지 않는다`);
  }
});

test("다크가 라이트의 색을 하나도 빠뜨리지 않는다", () => {
  const light = themedVars(LIGHT);
  assert.ok(light.size >= 8, "라이트 변수를 못 찾았다");

  for (const block of [
    { name: "다크(.dark · [data-theme] · [data-color-scheme=dark])", vars: themedVars(DARK) },
    { name: "system 다크(@media prefers-color-scheme)", vars: themedVars(SYSTEM_DARK) },
    { name: "라이트 고정([data-color-scheme=light])", vars: themedVars(FORCED_LIGHT) },
  ]) {
    assert.deepEqual(
      [...block.vars].sort(),
      [...light].sort(),
      `${block.name} 의 변수 목록이 기본(라이트)과 다르다`
    );
  }
});

test("system 다크와 일반 다크는 같은 값을 쓴다 — 켜지는 조건만 다르다", () => {
  const values = (block: string) =>
    [...block.matchAll(/(--dss-menu-[a-z-]+)\s*:\s*([^;]+);/g)]
      .map(([, name, value]) => `${name}:${value.trim()}`)
      .sort();

  assert.deepEqual(values(SYSTEM_DARK), values(DARK));
});

test("라이트 고정은 기본 라이트와 같은 값이다", () => {
  const values = (block: string) =>
    [...block.matchAll(/(--dss-menu-[a-z-]+)\s*:\s*([^;]+);/g)]
      .filter(([, name]) => !THEME_NEUTRAL.has(name))
      .map(([, name, value]) => `${name}:${value.trim()}`)
      .sort();

  assert.deepEqual(values(FORCED_LIGHT), values(LIGHT));
});

test("라이트 고정 규칙이 다크 규칙보다 뒤에 온다 — 같은 우선순위라 순서가 승부다", () => {
  assert.ok(
    CSS.indexOf('.dss-menu[data-color-scheme="light"]') > CSS.indexOf(".dark .dss-menu"),
    "다크 사이트에서 colorScheme=\"light\" 가 먹히지 않게 된다"
  );
});

test("사이트가 이미 쓰는 다크 표시 셋을 모두 받는다", () => {
  for (const signal of [
    ".dark .dss-menu", // RF_Service_System 의 @custom-variant dark
    '[data-theme="dark"] .dss-menu', // 흔한 다른 방식
    '.dss-menu[data-color-scheme="dark"]', // 이 띠만 고정할 때
  ]) {
    assert.ok(CSS.includes(signal), `${signal} 를 CSS 가 받지 않는다`);
  }
});

test("쓰는 변수는 전부 기본 블록에서 선언된다", () => {
  const declared = declaredVars(LIGHT);
  const used = new Set([...CSS.matchAll(/var\((--dss-menu-[a-z-]+)/g)].map((m) => m[1]));

  for (const name of used) {
    assert.ok(declared.has(name), `${name} 를 쓰는데 기본값이 없다`);
  }
});

test("좁은 화면에서 띠 안에서만 굴러간다 — 페이지가 가로로 밀리지 않는다", () => {
  const list = blockAfter(/\.dss-menu__list\s*\{([^}]*)\}/);

  assert.match(list, /overflow-x:\s*auto/);
  assert.match(list, /overscroll-behavior-x:\s*contain/);
  assert.match(blockAfter(/\.dss-menu__item\s*\{([^}]*)\}/), /flex:\s*0 0 auto/);
});

test("인쇄에는 나오지 않는다", () => {
  assert.match(CSS, /@media print\s*\{\s*\.dss-menu\s*\{\s*display:\s*none/);
});

test("색만으로 「지금 여기」를 알리지 않는다", () => {
  const current = blockAfter(/\.dss-menu__link\[data-current="true"\]\s*\{([^}]*)\}/);

  assert.match(current, /font-weight:\s*600/, "굵기로도 구분되어야 한다");
  assert.match(current, /box-shadow:\s*inset/, "밑줄로도 구분되어야 한다");
  assert.match(TSX, /aria-current=\{isCurrent \? "page" : undefined\}/);
});

test("키보드 초점 테두리가 있다", () => {
  assert.match(CSS, /\.dss-menu__link:focus-visible\s*\{[^}]*outline:/);
});

/* ──────────────────────────────────────────────────────────────────────────
 * 머리말 **안**에 앉는 모습(variant="inline") — 드롭다운
 *
 * 이 모습의 값은 거의 전부 CSS 에 있다(마크업은 단추와 목록을 내놓을 뿐,
 * 어디에 어떻게 뜨는지는 전부 여기다). 그래서 여기서 못 박는다: 바탕·테두리를
 * 갖지 않을 것, 기본 모습을 건드리지 않을 것, 펼친 목록이 **떠서** 그려질 것,
 * 폰에서 **단추의** 이름만 눈에서 감출 것(펼친 목록의 이름은 그대로 보인다),
 * 아이콘 없는 서비스에서 단추가 빈 칸이 되지 않을 것.
 * ────────────────────────────────────────────────────────────────────────── */

/** 폰(<768px) 규칙 덩어리. 이 파일에서 `not all and` 로 여는 유일한 곳이다. */
const NARROW = (() => {
  const at = CSS.indexOf("@media not all and (min-width: 768px)");
  assert.ok(at > 0, "폰에서 아이콘만 보이게 하는 @media 를 못 찾았다");
  return CSS.slice(at, CSS.indexOf("\n}", CSS.indexOf("\n  }", at)));
})();

test("🔴 새 모습은 제 바탕도 아래 테두리도 갖지 않는다 — 머리말 위에 그대로 얹힌다", () => {
  const inline = blockAfter(/\.dss-menu\.dss-menu--inline\s*\{([^}]*)\}/);

  assert.match(inline, /background-color:\s*transparent/);
  assert.match(inline, /border-bottom:\s*0/);
  // 맨 위 요소는 이제 머리말이다 — 인셋을 띠가 또 가지면 두 번 밀린다.
  assert.match(inline, /padding-top:\s*0/);
});

test("🔴 새 모습의 규칙은 전부 --inline 안에만 걸린다 — 기본 모습은 한 픽셀도 안 변한다", () => {
  // 선택자만 모아 본다(주석은 위에서 이미 걷어냈다).
  const selectors = [...CSS.matchAll(/(^|[{}])\s*([^{}@]+)\{/g)].map((m) => m[2].trim());
  const inlineOnly = ["dss-menu--inline", "data-has-icon", "dss-menu__initial"];

  for (const selector of selectors) {
    if (!inlineOnly.some((mark) => selector.includes(mark))) continue;
    // 기본값 한 줄(`.dss-menu__initial { display: none }`)만 예외다 — 그 줄이
    // 있어야 기본 모습에서 첫 글자가 **끝까지 보이지 않는다**.
    if (selector === ".dss-menu__initial") continue;
    assert.ok(
      selector.includes("dss-menu--inline"),
      `"${selector}" 가 새 모습 밖에서도 걸린다 — 기본 모습이 달라진다`
    );
  }
});

test("🔴 이름 첫 글자는 단추에서만 켜진다 — 기본 모습에서도 펼친 목록에서도 안 보인다", () => {
  assert.match(blockAfter(/\.dss-menu__initial\s*\{([^}]*)\}/), /display:\s*none/);
  // 켜 주는 곳은 폰 + 새 모습 + **단추** + 아이콘 없는 서비스, 네 조건이
  // 겹칠 때뿐이다. 펼친 목록에서는 이름이 늘 보이므로 첫 글자가 필요 없다.
  assert.match(
    NARROW,
    /\.dss-menu--inline \.dss-menu__summary\[data-has-icon="false"\] \.dss-menu__initial \{\s*display: inline-block;/
  );
  assert.equal(
    /\.dss-menu__link\[data-has-icon="false"\] \.dss-menu__initial/.test(CSS),
    false,
    "목록 칸에서 첫 글자를 켜는 규칙이 남아 있다 — 폰에서 「개 개선요청」이 된다"
  );
});

test("🔴 폰에서 단추의 이름은 **눈에서만** 감춰진다 — 낭독기는 그대로 읽는다", () => {
  const label = /\.dss-menu--inline \.dss-menu__label \{([^}]*)\}/.exec(NARROW);
  assert.ok(label, "폰 규칙에 단추 이름을 감추는 줄이 없다");

  assert.match(label[1], /position:\s*absolute/);
  assert.match(label[1], /clip-path:\s*inset\(50%\)/);
  assert.equal(
    /display:\s*none/.test(label[1]),
    false,
    "display:none 으로 지우면 단추 이름이 이모지 하나가 된다"
  );
  // 감춘 이름이 기대는 기준점. 없으면 페이지 어딘가로 튀어 나간다.
  assert.match(
    blockAfter(/\.dss-menu--inline \.dss-menu__dropdown\s*\{([^}]*)\}/),
    /position:\s*relative/
  );
});

test("🔴 펼친 목록의 이름은 폰에서도 보인다 — 감추는 것은 단추뿐이다", () => {
  // 이름 없이 이모지만 늘어선 목록은 고를 수가 없다. 목록은 머리말 폭을
  // 다투지 않고 떠서 그려지므로 감출 이유도 없다.
  assert.equal(
    /\.dss-menu__name \{[^}]*clip-path/.test(NARROW),
    false,
    "폰 규칙이 목록 칸의 이름까지 감춘다"
  );
  assert.equal(
    NARROW.includes("dss-menu__name"),
    false,
    "폰 규칙이 목록 칸의 이름을 건드린다"
  );
});

test("🔴 폰에서 아이콘 없는 서비스의 단추가 빈 칸이 되지 않는다 — 🔗 를 끄면 첫 글자를 켠다", () => {
  const hideIcon = /\[data-has-icon="false"\] \.dss-menu__icon \{\s*display: none;/.test(NARROW);
  const showInitial = /\[data-has-icon="false"\] \.dss-menu__initial \{\s*display: inline-block;/.test(NARROW);

  assert.equal(hideIcon, showInitial, "둘 중 하나만 있으면 빈 단추이거나 두 글자가 겹친다");
  assert.ok(hideIcon, "아이콘 없는 서비스를 폰에서 다루는 규칙이 사라졌다");
});

test("🔴 펼친 목록에서도 「지금 여기」는 굵기·색·밑줄로 남는다 — 색 하나에 기대지 않는다", () => {
  const current = blockAfter(
    /\.dss-menu--inline \.dss-menu__link\[data-current="true"\]\s*\{([^}]*)\}/
  );

  // 바탕만 끈다(목록이 이미 제 바탕 위에 떠 있다). 굵기·글자색·밑줄(box-shadow)은
  // 기본 규칙에서 물려받는다 — 여기서 그것들을 덮으면 흑백 인쇄에서도, 색을
  // 구분하지 못하는 사람에게도 지금 칸이 사라진다(UI_GUIDELINE 7절).
  assert.match(current, /background-color:\s*transparent/);
  assert.equal(/box-shadow/.test(current), false, "밑줄을 껐다");
  assert.equal(/font-weight/.test(current), false, "굵기를 덮어썼다");
});

test("새 모습에서는 손댄 티가 다크에서도 난다 — 머리말과 같은 색을 쓰지 않는다", () => {
  const hover = blockAfter(/\.dss-menu--inline \.dss-menu__link:hover\s*\{([^}]*)\}/);
  assert.match(hover, /var\(--dss-menu-inline-bg-hover\)/);

  const darkValue = /--dss-menu-inline-bg-hover:\s*([^;]+);/.exec(DARK)?.[1].trim();
  const darkHeader = /--dss-menu-current-bg:\s*([^;]+);/.exec(DARK)?.[1].trim();
  assert.ok(darkValue && darkHeader);
  assert.notEqual(darkValue, darkHeader, "다크에서 손댐 색이 머리말 색과 같다 — 아무 일도 없어 보인다");
});

/* ── 펼친 목록(드롭다운 패널) ─────────────────────────────────────────────── */

/** 머리말 안에 앉았을 때의 목록 규칙. 기본 모습의 것과 다른 블록이다. */
const PANEL = blockAfter(/\.dss-menu--inline \.dss-menu__list\s*\{([^}]*)\}/);

test("🔴 펼친 목록은 떠서 그려진다 — 열 때마다 머리말이 두꺼워지지 않는다", () => {
  // 제자리에 그리면 목록 높이만큼 머리말이 커져 본문이 아래로 밀린다.
  // 기준점은 단추와 목록을 함께 싸는 상자다(위 dropdown 시험).
  assert.match(PANEL, /position:\s*absolute/);
  assert.match(PANEL, /top:\s*calc\(100% \+ \d+px\)/);
  assert.match(PANEL, /z-index:/, "본문 위에 떠야 한다 — 쌓임 순서가 없으면 글자에 묻힌다");
});

test("🔴 펼친 목록은 제 바탕과 테두리를 갖는다 — 아래 글자가 비치면 못 읽는다", () => {
  assert.match(PANEL, /background-color:\s*var\(--dss-menu-panel-bg\)/);
  assert.match(PANEL, /border:\s*1px solid var\(--dss-menu-border\)/);
  assert.match(PANEL, /box-shadow:.*var\(--dss-menu-panel-shadow\)/);
});

test("펼친 목록은 세로로 굴러간다 — 가로 굴리기는 여기서 뜻을 잃었다", () => {
  assert.match(PANEL, /flex-direction:\s*column/);
  assert.match(PANEL, /max-height:/, "목록이 길면 화면 밖으로 흘러내린다");
  assert.match(PANEL, /overflow-y:\s*auto/);
  assert.match(PANEL, /overflow-x:\s*hidden/);
  assert.match(PANEL, /overscroll-behavior:\s*contain/, "끝까지 민 스크롤이 페이지로 샌다");
  // 폰(360px)에서도 화면 밖으로 나가지 않는다.
  assert.match(PANEL, /max-width:\s*min\(/);
});

test("🔴 단추도 키보드로 다다를 수 있다 — 초점 테두리가 있다", () => {
  assert.match(
    CSS,
    /\.dss-menu--inline \.dss-menu__summary:focus-visible\s*\{[^}]*outline:/
  );
  // 손댄 티도 난다 — 마우스 사용자에게 「눌리는 것」임을 알린다.
  assert.match(
    blockAfter(/\.dss-menu--inline \.dss-menu__summary:hover\s*\{([^}]*)\}/),
    /background-color:\s*var\(--dss-menu-inline-bg-hover\)/
  );
});

test("브라우저가 그리는 삼각형을 끄고 제 것을 그린다 — 아이콘과 자리를 다투지 않게", () => {
  const summary = blockAfter(/\.dss-menu--inline \.dss-menu__summary\s*\{([^}]*)\}/);
  assert.match(summary, /list-style:\s*none/, "파이어폭스에서 왼쪽에 삼각형이 남는다");
  assert.match(
    CSS,
    /\.dss-menu--inline \.dss-menu__summary::-webkit-details-marker\s*\{\s*display:\s*none/,
    "웹킷에서 왼쪽에 삼각형이 남는다"
  );

  // 제 삼각형은 글자가 아니라 테두리로 그린다 — "▾" 같은 글자는 기기에 따라
  // 이모지로 바뀌어 색도 크기도 제멋대로가 된다.
  const caret = blockAfter(/\.dss-menu--inline \.dss-menu__summary::after\s*\{([^}]*)\}/);
  assert.match(caret, /content:\s*""/);
  assert.match(caret, /border-top:\s*\d+px solid currentColor/);
  // 펼쳐지면 위를 가리킨다.
  assert.match(
    CSS,
    /\.dss-menu--inline \.dss-menu__dropdown\[open\] \.dss-menu__summary::after\s*\{[^}]*transform:\s*rotate\(180deg\)/
  );
});

test("🔴 단추는 목록 칸과 키가 같다 — 머리말 한 줄에서 혼자 튀지 않는다", () => {
  const summary = blockAfter(/\.dss-menu--inline \.dss-menu__summary\s*\{([^}]*)\}/);
  const link = blockAfter(/\.dss-menu__link\s*\{([^}]*)\}/);

  for (const 값 of [/min-height:\s*34px/, /font-size:\s*13px/, /line-height:\s*1\.2/]) {
    assert.match(summary, 값, "단추와 목록 칸의 값이 어긋났다");
    assert.match(link, 값);
  }
  // 손가락 화면에서도 함께 커진다(권고 44px).
  assert.match(
    CSS,
    /@media \(pointer: coarse\) \{\s*\.dss-menu--inline \.dss-menu__summary \{\s*min-height:\s*40px/
  );
});
