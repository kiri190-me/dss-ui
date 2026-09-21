import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NOTIFICATION_TONE_COUNT } from "./tone";

/**
 * 스타일시트를 **읽어서** 대조하는 시험.
 *
 * 이 조각의 화면은 브라우저 없이 확인할 수 없지만, 눈으로 못 잡는 대신 기계가
 * 잡을 수 있는 사고가 있다.
 *   1. 마크업이 쓰는 클래스에 규칙이 없다(오타 한 글자면 그 부분만 민짜가
 *      된다 — 라이트에서는 그럭저럭 읽혀 한참 뒤에 발견된다).
 *   2. 다크에만 값이 빠진다(그 색만 라이트 값을 물려받아 글자가 바탕에 묻는다).
 *   3. 선언하지 않은 변수를 쓴다(값이 비어 색이 기본값으로 떨어진다).
 *   4. 🔴 **색 칸 수가 tone.ts 와 어긋난다** — 셈이 내놓은 번호에 규칙이 없어
 *      그 종류만 색이 안 나온다. 그것도 조용히.
 */

const CSS = readFileSync(
  fileURLToPath(new URL("./notification-bell.css", import.meta.url)),
  "utf8"
).replace(/\/\*[\s\S]*?\*\//g, "");

const TSX = readFileSync(
  fileURLToPath(new URL("./NotificationBell.tsx", import.meta.url)),
  "utf8"
);

/** 선택자 뒤에 오는 한 블록의 속내를 뽑는다(이 파일에는 중첩 블록이 없다). */
function 블록(pattern: RegExp): string {
  const match = pattern.exec(CSS);
  assert.ok(match, `CSS 에서 ${pattern} 를 못 찾았다`);
  return match[1];
}

/** 블록 안에서 정의하는 --dss-bell-* 변수 이름들. */
function 선언한변수(block: string): Set<string> {
  return new Set([...block.matchAll(/(--dss-bell-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

/** 블록 안의 `이름:값` 목록. 두 블록이 같은 값인지 견줄 때 쓴다. */
function 값들(block: string): string[] {
  return [...block.matchAll(/(--dss-bell-[a-z0-9-]+)\s*:\s*([^;]+);/g)]
    .map(([, name, value]) => `${name}:${value.trim()}`)
    .sort();
}

const 라이트 = 블록(/\.dss-bell\s*\{([^}]*)\}/);
const 다크 = 블록(/\.dark \.dss-bell,[\s\S]*?\{([^}]*)\}/);
const 시스템다크 = 블록(
  /@media \(prefers-color-scheme: dark\)\s*\{\s*\.dss-bell\[data-color-scheme="system"\]\s*\{([^}]*)\}/
);
const 라이트고정 = 블록(/\.dss-bell\[data-color-scheme="light"\]\s*\{([^}]*)\}/);

test("마크업이 쓰는 클래스에는 전부 규칙이 있다", () => {
  const 쓰는것 = new Set([...TSX.matchAll(/"(dss-bell(?:__[a-z]+)?)[ "]/g)].map((m) => m[1]));

  assert.ok(쓰는것.size >= 8, `마크업에서 클래스를 못 찾았다(${[...쓰는것].join(", ")})`);
  for (const 이름 of 쓰는것) {
    assert.ok(CSS.includes(`.${이름}`), `.${이름} 규칙이 CSS 에 없다 — 그 부분만 민짜로 뜬다`);
  }
});

test("CSS 에만 있고 아무도 안 쓰는 클래스는 없다", () => {
  const 정의한것 = new Set([...CSS.matchAll(/\.(dss-bell__[a-z]+)/g)].map((m) => m[1]));

  for (const 이름 of 정의한것) {
    assert.ok(TSX.includes(`"${이름}"`), `.${이름} 을 마크업이 쓰지 않는다`);
  }
});

test("🔴 다크가 라이트의 색을 하나도 빠뜨리지 않는다", () => {
  const 기본 = 선언한변수(라이트);
  assert.ok(기본.size >= 8, "라이트 변수를 못 찾았다");

  for (const 벌 of [
    { name: "다크(.dark · [data-theme] · [data-color-scheme=dark])", vars: 선언한변수(다크) },
    { name: "system 다크(@media prefers-color-scheme)", vars: 선언한변수(시스템다크) },
    { name: "라이트 고정([data-color-scheme=light])", vars: 선언한변수(라이트고정) },
  ]) {
    assert.deepEqual(
      [...벌.vars].sort(),
      [...기본].sort(),
      `${벌.name} 의 변수 목록이 기본(라이트)과 다르다`
    );
  }
});

test("system 다크와 일반 다크는 같은 값을 쓴다 — 켜지는 조건만 다르다", () => {
  assert.deepEqual(값들(시스템다크), 값들(다크));
});

test("라이트 고정은 기본 라이트와 같은 값이다", () => {
  assert.deepEqual(값들(라이트고정), 값들(라이트));
});

test("라이트 고정 규칙이 다크 규칙보다 뒤에 온다 — 같은 우선순위라 순서가 승부다", () => {
  assert.ok(
    CSS.indexOf('.dss-bell[data-color-scheme="light"]') > CSS.indexOf(".dark .dss-bell"),
    '다크 사이트에서 colorScheme="light" 가 먹히지 않게 된다'
  );
});

test("사이트가 이미 쓰는 다크 표시 셋을 모두 받는다", () => {
  for (const 신호 of [
    ".dark .dss-bell", // RF_Service_System 의 @custom-variant dark
    '[data-theme="dark"] .dss-bell', // 흔한 다른 방식
    '.dss-bell[data-color-scheme="dark"]', // 이 종만 고정할 때
  ]) {
    assert.ok(CSS.includes(신호), `${신호} 를 CSS 가 받지 않는다`);
  }
});

test("쓰는 변수는 전부 기본 블록에서 선언된다", () => {
  const 선언 = 선언한변수(라이트);
  const 쓰는것 = new Set([...CSS.matchAll(/var\((--dss-bell-[a-z0-9-]+)/g)].map((m) => m[1]));

  for (const 이름 of 쓰는것) {
    assert.ok(선언.has(이름), `${이름} 를 쓰는데 기본값이 없다`);
  }
});

test("🔴 색 칸이 tone.ts 가 내놓는 수만큼 있다 — 라이트에도 다크에도", () => {
  for (const 벌 of [
    { name: "라이트", block: 라이트 },
    { name: "다크", block: 다크 },
    { name: "system 다크", block: 시스템다크 },
    { name: "라이트 고정", block: 라이트고정 },
  ]) {
    for (let tone = 0; tone < NOTIFICATION_TONE_COUNT; tone += 1) {
      assert.ok(
        선언한변수(벌.block).has(`--dss-bell-tone-${tone}`),
        `${벌.name} 에 --dss-bell-tone-${tone} 이 없다 — 그 종류만 색이 안 나온다`
      );
    }
  }
});

test("🔴 색 칸마다 그것을 고르는 규칙이 있다 — 셈이 내놓는 번호 전부", () => {
  for (let tone = 0; tone < NOTIFICATION_TONE_COUNT; tone += 1) {
    assert.match(
      CSS,
      new RegExp(
        `\\.dss-bell__kind\\[data-tone="${tone}"\\]\\s*\\{\\s*color: var\\(--dss-bell-tone-${tone}\\)`
      ),
      `data-tone="${tone}" 에 규칙이 없다`
    );
  }

  // 없는 번호에 규칙이 남아 있지도 않다(칸 수를 줄였을 때 쓰레기가 남는 길).
  const 규칙번호 = [...CSS.matchAll(/\.dss-bell__kind\[data-tone="(\d+)"\]/g)].map((m) =>
    Number(m[1])
  );
  assert.equal(Math.max(...규칙번호), NOTIFICATION_TONE_COUNT - 1);
});

test("🔴 종의 이름은 **눈에서만** 감춰진다 — 낭독기는 그대로 읽는다", () => {
  const 이름 = 블록(/\.dss-bell__label\s*\{([^}]*)\}/);

  assert.match(이름, /position:\s*absolute/);
  assert.match(이름, /clip-path:\s*inset\(50%\)/);
  assert.equal(
    /display:\s*none/.test(이름),
    false,
    "display:none 으로 지우면 종이 이름 없는 단추가 된다"
  );
  // 감춘 이름이 기대는 기준점. 없으면 페이지 어딘가로 튀어 나간다.
  assert.match(블록(/\.dss-bell\s*\{([^}]*)\}/), /position:\s*relative/);
});

test("🔴 펼친 목록은 떠서 그려진다 — 열 때마다 머리말이 두꺼워지지 않는다", () => {
  const 목록 = 블록(/\.dss-bell__list\s*\{([^}]*)\}/);

  assert.match(목록, /position:\s*absolute/);
  assert.match(목록, /top:\s*calc\(100% \+ \d+px\)/);
  assert.match(목록, /right:\s*0/, "종은 머리말 오른쪽 끝에 앉는다 — 왼쪽으로 펼쳐야 한다");
  assert.match(목록, /z-index:/, "본문 위에 떠야 한다 — 쌓임 순서가 없으면 글자에 묻힌다");
});

test("🔴 펼친 목록은 제 바탕과 테두리를 갖는다 — 아래 글자가 비치면 못 읽는다", () => {
  const 목록 = 블록(/\.dss-bell__list\s*\{([^}]*)\}/);

  assert.match(목록, /background-color:\s*var\(--dss-bell-panel-bg\)/);
  assert.match(목록, /border:\s*1px solid var\(--dss-bell-border\)/);
  assert.match(목록, /box-shadow:.*var\(--dss-bell-panel-shadow\)/);
});

test("긴 목록은 제 안에서 굴러가고, 폰에서도 화면 밖으로 나가지 않는다", () => {
  const 목록 = 블록(/\.dss-bell__list\s*\{([^}]*)\}/);

  assert.match(목록, /max-height:/, "목록이 길면 화면 밖으로 흘러내린다");
  assert.match(목록, /overflow-y:\s*auto/);
  assert.match(목록, /overscroll-behavior:\s*contain/, "끝까지 민 스크롤이 페이지로 샌다");
  assert.match(목록, /width:\s*min\(/, "폰(360px)에서 화면 밖으로 나간다");
});

test("배지는 종 위에 얹힌다 — 자리를 따로 차지하지 않는다", () => {
  const 배지 = 블록(/\.dss-bell__badge\s*\{([^}]*)\}/);

  assert.match(배지, /position:\s*absolute/);
  assert.match(배지, /min-width:/, "두 자리 수가 되면 동그라미가 글자를 자른다");
  assert.match(배지, /font-variant-numeric:\s*tabular-nums/, "숫자가 바뀔 때 폭이 들썩인다");
  // 기댈 자리는 종 단추다.
  assert.match(블록(/\.dss-bell__summary\s*\{([^}]*)\}/), /position:\s*relative/);
});

test("대상은 줄지 않고 상세가 먼저 줄어든다 — 인수번호가 잘리면 못 읽는다", () => {
  assert.match(블록(/\.dss-bell__subject\s*\{([^}]*)\}/), /flex:\s*0 0 auto/);

  const 상세 = 블록(/\.dss-bell__detail\s*\{([^}]*)\}/);
  assert.match(상세, /min-width:\s*0/);
  assert.match(상세, /text-overflow:\s*ellipsis/);
});

test("키보드 초점 테두리가 둘 다 있다 — 종에도, 줄에도", () => {
  assert.match(CSS, /\.dss-bell__summary:focus-visible\s*\{[^}]*outline:/);
  assert.match(CSS, /\.dss-bell__link:focus-visible\s*\{[^}]*outline:/);
});

test("브라우저가 그리는 삼각형을 끈다 — 종 옆에 삼각형이 붙으면 아이콘 단추가 아니다", () => {
  assert.match(블록(/\.dss-bell__summary\s*\{([^}]*)\}/), /list-style:\s*none/);
  assert.match(
    CSS,
    /\.dss-bell__summary::-webkit-details-marker\s*\{\s*display:\s*none/,
    "웹킷에서 왼쪽에 삼각형이 남는다"
  );
});

test("손가락 화면에서는 단추가 커진다(권고 44px)", () => {
  assert.match(CSS, /@media \(pointer: coarse\) \{\s*\.dss-bell__summary \{\s*width:\s*40px/);
});

test("인쇄에는 나오지 않는다", () => {
  assert.match(CSS, /@media print\s*\{\s*\.dss-bell\s*\{\s*display:\s*none/);
});
