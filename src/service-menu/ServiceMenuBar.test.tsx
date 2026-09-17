import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_SERVICE_ICON, ServiceMenuBar } from "./ServiceMenuBar";
import type { ServiceMenuEntry } from "./types";

/**
 * 메뉴바를 **진짜로 그려 보고** 나온 마크업을 확인한다.
 *
 * react-dom/server 로 그린다 — 브라우저도, jsdom 같은 새 라이브러리도
 * 필요 없다(react-dom 은 어차피 모든 사이트가 이미 쓴다). 이 조각에는
 * 상태도 이벤트도 없으므로 정적 마크업이 곧 화면이다.
 *
 * 규칙: **DOM 차례가 아니라 속성으로 찾는다**(data-service-id ·
 * data-current · aria-current). 나중에 감싸는 요소가 하나 더 생겨도
 * 시험이 깨지지 않게 하려는 것이다.
 */

const SERVICES: readonly ServiceMenuEntry[] = [
  { id: "dss-as", name: "A/S 관리", url: "https://as.example/", icon: "🛠️" },
  { id: "dss-meters", name: "계측기", url: "https://meters.example/", icon: "📐" },
  { id: "dss-improvements", name: "개선요청", url: "https://imp.example/" },
];

/** 그려진 차례대로 서비스 이름을 뽑는다. */
function renderedNames(html: string): string[] {
  return [...html.matchAll(/class="dss-menu__name">([^<]*)</g)].map((m) => m[1]);
}

/** 그려진 차례대로 서비스 식별자를 뽑는다. */
function renderedIds(html: string): string[] {
  return [...html.matchAll(/data-service-id="([^"]*)"/g)].map((m) => m[1]);
}

/** `지금 여기`로 표시된 칸의 식별자들. 하나뿐이어야 정상이다. */
function currentIds(html: string): string[] {
  return [...html.matchAll(/<a[^>]*>/g)]
    .filter((m) => m[0].includes('aria-current="page"'))
    .map((m) => /data-service-id="([^"]*)"/.exec(m[0])?.[1] ?? "(없음)");
}

test("목록이 비면 아무것도 그리지 않는다 — 던지지도 않는다", () => {
  assert.equal(renderToStaticMarkup(<ServiceMenuBar services={[]} />), "");
  assert.equal(
    renderToStaticMarkup(<ServiceMenuBar services={[]} currentServiceId="dss-as" />),
    "",
    "지금 서비스를 넘겨도 목록이 비면 빈 띠를 남기지 않는다"
  );
});

test("받은 차례 그대로 그린다 — 여기서 다시 정렬하지 않는다", () => {
  const html = renderToStaticMarkup(<ServiceMenuBar services={SERVICES} />);

  assert.deepEqual(renderedNames(html), ["A/S 관리", "계측기", "개선요청"]);
  assert.deepEqual(renderedIds(html), ["dss-as", "dss-meters", "dss-improvements"]);
});

test("거꾸로 받으면 거꾸로 그린다 — 차례는 넘긴 쪽이 정한다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={[...SERVICES].reverse()} />
  );

  assert.deepEqual(renderedIds(html), ["dss-improvements", "dss-meters", "dss-as"]);
});

test("지금 있는 서비스 한 칸만 눌린 상태가 된다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-meters" />
  );

  assert.deepEqual(currentIds(html), ["dss-meters"]);
  assert.match(html, /data-service-id="dss-meters"/);
  // 색뿐 아니라 CSS 가 잡을 표시(data-current)도 정확히 한 칸이다.
  assert.equal([...html.matchAll(/data-current="true"/g)].length, 1);
  assert.equal([...html.matchAll(/data-current="false"/g)].length, 2);
});

test("지금 서비스를 안 넘기면 아무 칸도 눌리지 않는다", () => {
  for (const html of [
    renderToStaticMarkup(<ServiceMenuBar services={SERVICES} />),
    renderToStaticMarkup(<ServiceMenuBar services={SERVICES} currentServiceId={null} />),
  ]) {
    assert.deepEqual(currentIds(html), []);
    assert.equal(renderedIds(html).length, 3, "그래도 목록은 다 그린다");
  }
});

test("모르는 id 를 넘겨도 죽지 않는다 — 아무 칸도 안 눌릴 뿐이다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="없는-서비스" />
  );

  assert.deepEqual(currentIds(html), []);
  assert.equal(renderedIds(html).length, 3);
});

test("이름이 아니라 식별자로 견준다 — 이름이 같아도 자기 칸만 눌린다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar
      services={[
        { id: "old-as", name: "A/S 관리", url: "https://old.example/" },
        { id: "dss-as", name: "A/S 관리", url: "https://as.example/" },
      ]}
      currentServiceId="dss-as"
    />
  );

  assert.deepEqual(currentIds(html), ["dss-as"]);
});

test("넘긴 주소를 그대로 링크로 건다 — 주소를 만들지도 고치지도 않는다", () => {
  const html = renderToStaticMarkup(<ServiceMenuBar services={SERVICES} />);

  for (const service of SERVICES) {
    assert.ok(
      html.includes(`href="${service.url}"`),
      `${service.id} 의 주소가 그대로 들어가야 한다`
    );
  }
  // 새 창으로 열지 않는다 — 사내 시스템을 오가는 동선이라 탭이 쌓이면 안 된다.
  assert.equal(html.includes("target="), false);
});

test("아이콘이 없으면 포털 타일과 같은 기본 글자를 쓴다", () => {
  const html = renderToStaticMarkup(<ServiceMenuBar services={SERVICES} />);
  const icons = [...html.matchAll(/class="dss-menu__icon"[^>]*>([^<]*)</g)].map(
    (m) => m[1]
  );

  assert.deepEqual(icons, ["🛠️", "📐", DEFAULT_SERVICE_ICON]);
  assert.equal(DEFAULT_SERVICE_ICON, "🔗", "포털 /apps 타일의 기본값과 같아야 한다");
});

test("그릴 수 없는 주소의 칸은 빼고 나머지는 그린다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar
      services={[
        { id: "evil", name: "나쁜 링크", url: "javascript:alert(1)" },
        ...SERVICES,
      ]}
    />
  );

  assert.deepEqual(renderedIds(html), ["dss-as", "dss-meters", "dss-improvements"]);
  assert.equal(html.includes("javascript:"), false);
});

test("그릴 수 있는 칸이 하나도 없으면 빈 띠 대신 아무것도 안 그린다", () => {
  assert.equal(
    renderToStaticMarkup(
      <ServiceMenuBar services={[{ id: "evil", name: "나쁨", url: "javascript:x" }]} />
    ),
    ""
  );
});

test("이름에 든 꺾쇠는 글자로 나간다 — 마크업이 되지 않는다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar
      services={[{ id: "x", name: "<script>bad</script>", url: "/x" }]}
    />
  );

  assert.equal(html.includes("<script>"), false);
  assert.match(html, /&lt;script&gt;/);
});

test("서비스가 열로 늘어도 열 칸을 그린다", () => {
  const many: ServiceMenuEntry[] = Array.from({ length: 10 }, (_, index) => ({
    id: `svc-${index}`,
    name: `서비스 ${index}`,
    url: `/svc-${index}`,
  }));

  const html = renderToStaticMarkup(
    <ServiceMenuBar services={many} currentServiceId="svc-7" />
  );

  assert.equal(renderedIds(html).length, 10);
  assert.deepEqual(currentIds(html), ["svc-7"]);
});

test("화면 낭독기를 위한 이름이 붙고, 필요하면 바꿀 수 있다", () => {
  assert.match(
    renderToStaticMarkup(<ServiceMenuBar services={SERVICES} />),
    /<nav[^>]*aria-label="사내 시스템 바로가기"/
  );
  assert.match(
    renderToStaticMarkup(<ServiceMenuBar services={SERVICES} label="서비스 이동" />),
    /<nav[^>]*aria-label="서비스 이동"/
  );
});

test("밝기 기준은 기본이 host 이고, 넘기면 그 값이 마크업에 실린다", () => {
  assert.match(
    renderToStaticMarkup(<ServiceMenuBar services={SERVICES} />),
    /data-color-scheme="host"/
  );
  for (const scheme of ["light", "dark", "system"] as const) {
    assert.match(
      renderToStaticMarkup(<ServiceMenuBar services={SERVICES} colorScheme={scheme} />),
      new RegExp(`data-color-scheme="${scheme}"`)
    );
  }
});

test("사이트가 준 className 은 묶음 클래스 뒤에 붙는다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} className="shrink-0 print:hidden" />
  );

  assert.match(html, /class="dss-menu shrink-0 print:hidden"/);
});

test("목록 자체는 <nav> 안의 <ul> 이다 — 낭독기가 「목록 3개」로 읽는다", () => {
  const html = renderToStaticMarkup(<ServiceMenuBar services={SERVICES} />);

  assert.match(html, /^<nav /);
  assert.match(html, /<ul class="dss-menu__list">/);
  assert.equal([...html.matchAll(/<li class="dss-menu__item">/g)].length, 3);
});
