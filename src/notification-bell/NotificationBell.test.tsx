import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { NotificationBell } from "./NotificationBell";
import { notificationToneIndex } from "./tone";
import type { NotificationBellItem } from "./types";

/**
 * 종을 **진짜로 그려 보고** 나온 마크업을 확인한다.
 *
 * react-dom/server 로 그린다 — 브라우저도, jsdom 같은 새 라이브러리도 필요
 * 없다(react-dom 은 어차피 모든 사이트가 이미 쓴다). 🔴 펼침·접힘을
 * <details> 에 맡긴 덕에 **펼친 속까지** 정적 마크업 하나에 다 들어 있다 —
 * useState 로 여닫았다면 여기서는 늘 닫힌 종만 보였을 것이다.
 *
 * 규칙: **DOM 차례가 아니라 속성·클래스로 찾는다**. 나중에 감싸는 요소가
 * 하나 더 생겨도 시험이 깨지지 않게 하려는 것이다.
 */

function 줄(덮어쓸값: Partial<NotificationBellItem> = {}): NotificationBellItem {
  return {
    key: "dss-as:REPAIR_CASE_APPROVAL:1",
    sourceId: "dss-as",
    sourceName: "A/S 관리",
    id: "REPAIR_CASE_APPROVAL:1",
    kind: "REPAIR_CASE_APPROVAL",
    kindLabel: "결재 대기",
    subject: "2026-0001",
    detail: "수리 검수 승인",
    href: "https://as.example/repair-cases/1/approval",
    ...덮어쓸값,
  };
}

const 세줄: readonly NotificationBellItem[] = [
  줄(),
  줄({
    key: "dss-as:PART_REQUEST_PENDING:2",
    id: "PART_REQUEST_PENDING:2",
    kind: "PART_REQUEST_PENDING",
    kindLabel: "부품 요청 대기",
    subject: "2026-0002",
    detail: "요청 대기 · 이엔지",
    href: "https://as.example/inventory/requests",
  }),
  줄({
    key: "dss-imp:IDEA:7",
    sourceId: "dss-improvements",
    sourceName: "개선요청",
    id: "IDEA:7",
    kind: "IDEA_REVIEW",
    kindLabel: "검토 대기",
    subject: "IMP-7",
    detail: "라인 3 지그 교체",
    href: "https://imp.example/ideas/7",
  }),
];

/** 그려진 차례대로 링크 주소를 뽑는다. */
function 주소들(html: string): string[] {
  return [...html.matchAll(/class="dss-bell__link" href="([^"]*)"/g)].map((m) => m[1]);
}

/** 그려진 차례대로 줄의 열쇠를 뽑는다. */
function 열쇠들(html: string): string[] {
  return [...html.matchAll(/data-notification-key="([^"]*)"/g)].map((m) => m[1]);
}

/** 배지에 찍힌 글자. 배지가 없으면 null. */
function 배지(html: string): string | null {
  return /class="dss-bell__badge"[^>]*>([^<]*)</.exec(html)?.[1] ?? null;
}

/** 낭독기가 읽을 이름. */
function 이름(html: string): string | null {
  return /class="dss-bell__label">([^<]*)</.exec(html)?.[1] ?? null;
}

/** 종류 이름과 그 색 칸 번호를 짝지어 뽑는다. */
function 종류들(html: string): { tone: string; label: string }[] {
  return [...html.matchAll(/class="dss-bell__kind" data-tone="(\d+)">([^<]*)</g)].map((m) => ({
    tone: m[1],
    label: m[2],
  }));
}

test("🔴 목록이 비면 아무것도 그리지 않는다 — 배지도, 빈 종도 남기지 않는다", () => {
  assert.equal(renderToStaticMarkup(<NotificationBell items={[]} count={0} />), "");
  assert.equal(
    renderToStaticMarkup(<NotificationBell items={[]} count={9} />),
    "",
    "개수만 와도 그릴 줄이 없으면 배지를 띄우지 않는다"
  );
});

test("🔴 그릴 수 없는 주소만 들어오면 역시 아무것도 그리지 않는다", () => {
  const html = renderToStaticMarkup(
    <NotificationBell items={[줄({ href: "javascript:alert(1)" })]} count={1} />
  );

  assert.equal(html, "");
});

test("🔴 그릴 수 없는 주소는 그 줄만 빠진다 — 멀쩡한 줄까지 사라지지 않는다", () => {
  const html = renderToStaticMarkup(
    <NotificationBell
      items={[줄({ key: "a", href: "javascript:alert(1)" }), 줄({ key: "b" }), 줄({ key: "c", href: "//as.example/x" })]}
      count={3}
    />
  );

  assert.deepEqual(열쇠들(html), ["b"]);
  assert.equal(html.includes("javascript:"), false, "글자로도 남기지 않는다");
});

test("🔴 링크는 **받은 그대로** 나간다 — 앞에 무엇도 붙이지 않는다", () => {
  const 주소 = [
    "https://as.example/repair-cases/1/approval?tab=1#top",
    "http://192.168.0.10:3000/inventory/requests",
    "/inventory/requests",
  ];
  const html = renderToStaticMarkup(
    <NotificationBell
      items={주소.map((href, index) => 줄({ key: `k${index}`, href }))}
      count={주소.length}
    />
  );

  assert.deepEqual(주소들(html), 주소);
});

test("받은 차례 그대로 그린다 — 여기서 다시 섞지 않는다", () => {
  const html = renderToStaticMarkup(<NotificationBell items={세줄} count={3} />);
  assert.deepEqual(열쇠들(html), [세줄[0].key, 세줄[1].key, 세줄[2].key]);

  const 거꾸로 = renderToStaticMarkup(<NotificationBell items={[...세줄].reverse()} count={3} />);
  assert.deepEqual(열쇠들(거꾸로), [세줄[2].key, 세줄[1].key, 세줄[0].key]);
});

test("🔴 배지는 **받은 값 그대로**다 — 줄 수로 다시 세지 않는다", () => {
  // 줄은 셋인데 보낸 쪽은 7 이라고 했다(시스템마다 세는 규칙이 다르다 —
  // A/S 는 같은 대상을 한 번만 센다). 종은 그 값을 그대로 찍는다.
  const html = renderToStaticMarkup(<NotificationBell items={세줄} count={7} />);

  assert.equal(배지(html), "7");
  assert.equal(이름(html), "알림 7건");
});

test("0 건이면 배지를 안 그린다 — 종은 그대로 있다", () => {
  const html = renderToStaticMarkup(<NotificationBell items={세줄} count={0} />);

  assert.equal(배지(html), null, '"0" 이라고 적힌 배지는 할 일이 있는 것처럼 보인다');
  assert.equal(이름(html), "알림");
  assert.equal(열쇠들(html).length, 3, "배지가 없어도 목록은 그린다");
});

test("숫자가 아니거나 음수인 개수에도 죽지 않는다 — 배지만 없다", () => {
  for (const count of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const html = renderToStaticMarkup(<NotificationBell items={세줄} count={count} />);
    assert.equal(배지(html), null, `${count}`);
    assert.equal(열쇠들(html).length, 3);
  }
});

test("낭독기에 읽힐 이름을 사이트가 바꿀 수 있다", () => {
  const html = renderToStaticMarkup(<NotificationBell items={세줄} count={2} label="새 소식" />);
  assert.equal(이름(html), "새 소식 2건");
});

test("🔴 자바스크립트 없이 펼쳐진다 — 마크업에 스크립트가 한 조각도 없다", () => {
  const html = renderToStaticMarkup(
    <NotificationBell items={세줄} count={3} onAcknowledge={() => {}} />
  );

  assert.match(html, /<details class="dss-bell"/, "브라우저가 펼치고 접는다");
  assert.match(html, /<summary class="dss-bell__summary"/);
  for (const 금지 of ["<script", "onclick", "<button", "<select", "javascript:"]) {
    assert.equal(html.includes(금지), false, `${금지} 가 마크업에 있다`);
  }
  // 줄은 평범한 <a href> 다 — 스크립트가 없어도 눌리면 그대로 나간다.
  assert.equal(주소들(html).length, 3);
});

test("🔴 곁들인 조각은 마크업을 한 글자도 늘리지 않는다 — 서버에서 그려도 터지지 않는다", () => {
  const 확인없이 = renderToStaticMarkup(<NotificationBell items={세줄} count={3} />);
  const 확인있이 = renderToStaticMarkup(
    <NotificationBell items={세줄} count={3} onAcknowledge={() => {}} />
  );

  assert.equal(확인있이, 확인없이);
});

test("🔴 종류는 색과 **함께 글자로도** 그린다 — 색 하나에 기대지 않는다", () => {
  const html = renderToStaticMarkup(<NotificationBell items={세줄} count={3} />);
  const 종류 = 종류들(html);

  assert.deepEqual(
    종류.map((칸) => 칸.label),
    ["결재 대기", "부품 요청 대기", "검토 대기"]
  );
  // 색 칸은 종류 코드가 정한다(tone.ts) — 화면이 종류를 보고 갈라지지 않는다.
  assert.deepEqual(
    종류.map((칸) => 칸.tone),
    세줄.map((item) => String(notificationToneIndex(item.kind)))
  );
  assert.equal(new Set(종류.map((칸) => 칸.tone)).size, 3, "세 종류가 같은 색이 되었다");
});

test("같은 종류는 같은 색 칸이다 — 줄이 달라도", () => {
  const html = renderToStaticMarkup(
    <NotificationBell
      items={[줄({ key: "a" }), 줄({ key: "b", subject: "2026-0009" })]}
      count={2}
    />
  );
  const [첫째, 둘째] = 종류들(html);

  assert.equal(첫째.tone, 둘째.tone);
});

test("보낸 쪽이 안 실은 칸은 그리지 않는다 — 빈 자리가 남지 않는다", () => {
  const html = renderToStaticMarkup(
    <NotificationBell
      items={[줄({ kind: "", kindLabel: "", sourceName: "", detail: "" })]}
      count={1}
    />
  );

  assert.equal(html.includes("dss-bell__kind"), false);
  assert.equal(html.includes("dss-bell__source"), false);
  assert.equal(html.includes("dss-bell__detail"), false);
  assert.equal(html.includes("dss-bell__separator"), false, "가운뎃점만 덩그러니 남는다");
  // 대상은 언제나 그린다 — 그것마저 없으면 무엇에 대한 알림인지 알 수 없다.
  assert.match(html, /class="dss-bell__subject">2026-0001</);
});

test("🔴 열쇠를 줄마다 싣는다 — 눌린 줄을 확인 조각이 이 값으로 되찾는다", () => {
  const html = renderToStaticMarkup(<NotificationBell items={세줄} count={3} />);

  assert.deepEqual(열쇠들(html), [세줄[0].key, 세줄[1].key, 세줄[2].key]);
  assert.match(html, /data-source-id="dss-improvements"/);
});

test("🔴 남의 시스템에서 온 글자는 글자로만 그려진다 — 마크업이 되지 않는다", () => {
  const html = renderToStaticMarkup(
    <NotificationBell
      items={[줄({ subject: "<img src=x onerror=1>", detail: "a & b", kindLabel: "<b>굵게</b>" })]}
      count={1}
    />
  );

  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("<b>"), false);
  assert.match(html, /&lt;img/);
  assert.match(html, /a &amp; b/);
});

test("사이트가 준 className 은 **뒤에** 붙는다 — 사이트 것이 이긴다", () => {
  const html = renderToStaticMarkup(
    <NotificationBell items={세줄} count={1} className="shrink-0 ml-auto" />
  );

  assert.match(html, /class="dss-bell shrink-0 ml-auto"/);
});

test("밝기 기본값은 host — 사이트를 따라간다", () => {
  const 기본 = renderToStaticMarkup(<NotificationBell items={세줄} count={1} />);
  assert.match(기본, /data-color-scheme="host"/);

  const 고정 = renderToStaticMarkup(
    <NotificationBell items={세줄} count={1} colorScheme="light" />
  );
  assert.match(고정, /data-color-scheme="light"/);
});

test("줄이 열이어도 그린다 — 목록은 제 안에서 굴러간다(CSS)", () => {
  const 열줄 = Array.from({ length: 10 }, (_, index) =>
    줄({ key: `k${index}`, subject: `2026-00${index}` })
  );
  const html = renderToStaticMarkup(<NotificationBell items={열줄} count={10} />);

  assert.equal(열쇠들(html).length, 10);
});
