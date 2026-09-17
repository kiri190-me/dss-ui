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
