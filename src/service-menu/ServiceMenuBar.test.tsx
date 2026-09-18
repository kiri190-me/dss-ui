import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_SERVICE_ICON, ServiceMenuBar, serviceInitial } from "./ServiceMenuBar";
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

/* ──────────────────────────────────────────────────────────────────────────
 * 앉는 모습 두 가지 — 머리말 **위**(기본) · 머리말 **안**
 *
 * 생김새 자체는 CSS 가 갖는다(그쪽은 service-menu.css.test.ts 가 본다).
 * 여기서 못 박는 것은 **마크업이 두 모습을 어떻게 가르느냐**다:
 * 기본값이 예전과 글자 하나 다르지 않을 것, 새 모습이 클래스 하나만 더할 것,
 * 그리고 폰에서 아이콘만 보일 때 CSS 가 잡을 손잡이(data-has-icon ·
 * dss-menu__initial)가 마크업에 실려 있을 것.
 * ────────────────────────────────────────────────────────────────────────── */

test("🔴 기본값은 예전 그대로다 — variant 를 안 넘긴 것과 \"bar\" 가 글자 하나까지 같다", () => {
  const 기본값 = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-as" />
  );
  const 띠 = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-as" variant="bar" />
  );

  assert.equal(기본값, 띠);
  assert.match(기본값, /class="dss-menu"/);
  assert.equal(
    기본값.includes("dss-menu--inline"),
    false,
    "기본 모습에 새 모습의 클래스가 섞였다 — 계측기·개선요청 화면이 달라진다"
  );
});

test("🔴 새 모습은 클래스 하나만 더한다 — 링크·차례·「지금 여기」는 그대로다", () => {
  const 띠 = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-as" variant="bar" />
  );
  const 머리말안 = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-as" variant="inline" />
  );

  assert.match(머리말안, /class="dss-menu dss-menu--inline"/);
  assert.equal(
    머리말안.replace(" dss-menu--inline", ""),
    띠,
    "클래스 말고도 달라진 것이 있다 — 두 모습의 차이는 CSS 가 가져야 한다"
  );
});

test("사이트가 준 className 은 새 모습에서도 맨 뒤에 붙는다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} variant="inline" className="min-w-0 flex-1" />
  );

  assert.match(html, /class="dss-menu dss-menu--inline min-w-0 flex-1"/);
});

test("🔴 두 모습 모두 지금 있는 서비스를 알아볼 수 있게 표시한다", () => {
  for (const variant of ["bar", "inline"] as const) {
    const html = renderToStaticMarkup(
      <ServiceMenuBar services={SERVICES} currentServiceId="dss-meters" variant={variant} />
    );

    assert.deepEqual(currentIds(html), ["dss-meters"], `${variant}: 「지금 여기」가 없다`);
    assert.equal(
      [...html.matchAll(/data-current="true"/g)].length,
      1,
      `${variant}: CSS 가 잡을 표시가 한 칸이 아니다`
    );
  }
});

test("🔴 빈 목록이면 두 모습 다 아무것도 그리지 않는다", () => {
  for (const variant of ["bar", "inline"] as const) {
    assert.equal(renderToStaticMarkup(<ServiceMenuBar services={[]} variant={variant} />), "");
  }
});

/* ── 폰에서 아이콘만 보이는 모습이 기대는 손잡이들 ───────────────────────── */

test("🔴 아이콘이 있는지를 칸마다 싣는다 — 폰에서 무엇을 보일지 CSS 가 이걸로 고른다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} variant="inline" />
  );
  const flags = [...html.matchAll(/data-has-icon="([^"]*)"/g)].map((m) => m[1]);

  // SERVICES 의 셋째(개선요청)만 icon 키가 없다.
  assert.deepEqual(flags, ["true", "true", "false"]);
});

test("🔴 아이콘 없는 칸은 폰에서 빈 칸이 되지 않는다 — 이름 첫 글자가 실려 있다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} variant="inline" />
  );
  const initials = [...html.matchAll(/class="dss-menu__initial"[^>]*>([^<]*)</g)].map(
    (m) => m[1]
  );

  assert.deepEqual(initials, ["개"], "아이콘이 없는 칸(개선요청)에만, 이름 첫 글자로");
  // 아이콘이 있는 칸에는 첫 글자를 얹지 않는다 — 폰에서 둘 다 보이면 겹친다.
  assert.equal([...html.matchAll(/dss-menu__initial/g)].length, 1);
});

test("아이콘 없는 칸이 둘이어도 서로 달라 보인다 — 🔗 하나로 뭉뚱그리지 않는다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar
      variant="inline"
      services={[
        { id: "a", name: "개선요청", url: "/a" },
        { id: "b", name: "견적", url: "/b" },
      ]}
    />
  );
  const initials = [...html.matchAll(/class="dss-menu__initial"[^>]*>([^<]*)</g)].map(
    (m) => m[1]
  );

  assert.deepEqual(initials, ["개", "견"]);
});

test("첫 글자는 낭독기에서 감춰진다 — 이름이 따로 읽히기 때문이다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} variant="inline" />
  );

  assert.match(html, /<span class="dss-menu__initial" aria-hidden="true">/);
});

test("🔴 이름은 두 모습 모두 마크업에 남는다 — 폰에서 감추는 것은 눈에서만이다", () => {
  for (const variant of ["bar", "inline"] as const) {
    const html = renderToStaticMarkup(
      <ServiceMenuBar services={SERVICES} variant={variant} />
    );

    assert.deepEqual(
      renderedNames(html),
      ["A/S 관리", "계측기", "개선요청"],
      `${variant}: 이름이 마크업에서 사라졌다 — 낭독기가 이모지만 읽게 된다`
    );
  }
});

test("이름 첫 글자 고르기 — 이모지를 반으로 쪼개지 않고, 빈 이름이어도 빈 칸을 남기지 않는다", () => {
  assert.equal(serviceInitial("개선요청"), "개");
  assert.equal(serviceInitial("  계측기 "), "계");
  assert.equal(serviceInitial("Quotes"), "Q");
  assert.equal(serviceInitial("🛠️도구"), "🛠", "서로게이트 쌍이 깨지면 안 된다");
  assert.equal(serviceInitial(""), DEFAULT_SERVICE_ICON, "빈 칸만은 남기지 않는다");
  assert.equal(serviceInitial("   "), DEFAULT_SERVICE_ICON);
});
