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

/** 드롭다운 단추(<summary>) 안에 그려진 것. 없으면 빈 글자다. */
function summaryInner(html: string): string {
  return /<summary[^>]*>([\s\S]*?)<\/summary>/.exec(html)?.[1] ?? "";
}

/** 드롭다운 단추의 여는 태그 — 속성을 보려는 것이다. */
function summaryTag(html: string): string {
  return /<summary[^>]*>/.exec(html)?.[0] ?? "";
}

/** 단추에 선 이름(.dss-menu__label). 목록 칸의 이름과 섞이지 않는다. */
function buttonName(html: string): string | null {
  return /class="dss-menu__label">([^<]*)</.exec(html)?.[1] ?? null;
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
 * 앉는 모습 두 가지 — 머리말 **위**(기본, 가로 띠) · 머리말 **안**(드롭다운)
 *
 * 생김새 자체는 CSS 가 갖는다(그쪽은 service-menu.css.test.ts 가 본다).
 * 여기서 못 박는 것은 **마크업이 두 모습을 어떻게 가르느냐**다: 기본값이
 * 예전과 글자 하나 다르지 않을 것, 새 모습이 같은 목록을 <details> 로 감싸
 * **자바스크립트 없이** 펼쳐질 것, 단추에 지금 있는 서비스가 설 것, 그리고
 * 폰에서 단추가 아이콘 하나로 줄어들 때 CSS 가 잡을 손잡이(data-has-icon ·
 * dss-menu__initial)가 실려 있을 것.
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
    "기본 모습에 새 모습의 클래스가 섞였다 — 그 모습으로 커밋된 화면이 달라진다"
  );
  // 🔴 드롭다운은 새 모습만의 것이다. 기본 모습은 예전처럼 목록이 nav 바로
  //    아래에 통째로 펼쳐져 있다 — 감싸는 요소가 하나도 끼어들지 않는다.
  assert.equal(기본값.includes("<details"), false, "기본 모습에 드롭다운이 섞였다");
  assert.equal(기본값.includes("<summary"), false, "기본 모습에 단추가 섞였다");
  assert.match(기본값, /^<nav [^>]*><ul class="dss-menu__list">/);
});

test("🔴 새 모습은 같은 목록을 <details> 로 감싼다 — 링크·차례·「지금 여기」는 그대로다", () => {
  const 띠 = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-as" variant="bar" />
  );
  const 드롭다운 = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-as" variant="inline" />
  );

  assert.match(드롭다운, /class="dss-menu dss-menu--inline"/);
  assert.match(드롭다운, /<details class="dss-menu__dropdown">/);

  // 목록 자체(<ul>…</ul>)는 두 모습이 **같다**. 달라지는 것은 그것을 감싸는
  // 것뿐이라, 링크도 차례도 「지금 여기」도 한 곳에서만 정해진다.
  const 목록 = (html: string) =>
    /<ul class="dss-menu__list">[\s\S]*<\/ul>/.exec(html)?.[0] ?? "";

  assert.notEqual(목록(띠), "", "띠에서 목록을 못 찾았다 — 아래 대조가 공짜로 통과한다");
  assert.equal(
    목록(드롭다운),
    목록(띠),
    "목록이 모습마다 달라졌다 — 차이는 감싸는 것에만 있어야 한다"
  );
});

test("🔴 자바스크립트 없이 펼쳐진다 — <details>/<summary> 라 브라우저가 스스로 연다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-as" variant="inline" />
  );

  // 펼치고 접는 일을 브라우저가 한다. 사내망에서 스크립트가 늦게 붙는 동안
  // 눌러도 목록이 열리고 링크로 나가진다 — 이 저장소들의 철학이다.
  assert.match(html, /<details class="dss-menu__dropdown">/);
  assert.match(html, /<summary class="dss-menu__summary"[^>]*>/);

  // 🔴 스크립트가 있어야만 움직이는 장치를 쓰지 않는다. <select onChange> 로
  //    만들었다면 스크립트가 붙기 전에는 아무 데도 갈 수 없다.
  const 낮춘것 = html.toLowerCase();
  for (const 손잡이 of ["<script", "<select", "<button", "onclick", "onchange", "javascript:"]) {
    assert.equal(
      낮춘것.includes(손잡이),
      false,
      `${손잡이} 가 들어갔다 — 스크립트가 붙기 전에는 못 쓰는 메뉴가 된다`
    );
  }

  // 처음에는 접혀 있다(open 을 달지 않는다) — 열린 채로 그려지면 화면을 열 때마다
  // 목록이 본문을 가린다.
  assert.equal(/<details[^>]*\sopen/.test(html), false, "펼쳐진 채로 그려진다");
});

test("🔴 펼친 목록의 칸은 여전히 평범한 <a href> 다 — 눌러서 간다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-as" variant="inline" />
  );

  for (const service of SERVICES) {
    assert.ok(
      html.includes(`href="${service.url}"`),
      `${service.id} 의 주소가 그대로 들어가야 한다`
    );
  }
  assert.equal(
    [...html.matchAll(/<a class="dss-menu__link" href=/g)].length,
    3,
    "칸이 <a href> 가 아닌 다른 것이 되었다"
  );
  // 새 창으로 열지 않는다 — 사내 시스템을 오가는 동선이라 탭이 쌓이면 안 된다.
  assert.equal(html.includes("target="), false);
});

test("🔴 단추에 지금 있는 서비스가 보인다 — 펼치지 않아도 어디 있는지 안다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-meters" variant="inline" />
  );

  assert.equal(buttonName(html), "계측기");
  assert.match(summaryInner(html), /class="dss-menu__icon" aria-hidden="true">📐</);
  assert.match(summaryTag(html), /data-has-icon="true"/);

  // 펼친 목록에서도 그 칸을 알 수 있다(aria-current 는 그대로다).
  assert.deepEqual(currentIds(html), ["dss-meters"]);
});

test("🔴 아이콘 없는 서비스에 있으면 단추가 🔗 하나로 끝나지 않는다 — 첫 글자가 실린다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar
      services={SERVICES}
      currentServiceId="dss-improvements"
      variant="inline"
    />
  );

  assert.equal(buttonName(html), "개선요청");
  assert.match(summaryTag(html), /data-has-icon="false"/);
  // 폰에서 CSS 가 아이콘 대신 켜는 글자.
  assert.match(summaryInner(html), /class="dss-menu__initial" aria-hidden="true">개</);
  // 넓은 화면에서 보일 기본 아이콘도 함께 실려 있다 — 무엇을 보일지는 CSS 가 고른다
  // (이 조각은 화면 폭을 모른다. 서버에서도 그려진다).
  assert.match(
    summaryInner(html),
    new RegExp(`class="dss-menu__icon" aria-hidden="true">${DEFAULT_SERVICE_ICON}<`)
  );
});

test("아이콘 없는 서비스가 둘이어도 단추가 서로 달라 보인다 — 🔗 하나로 뭉뚱그리지 않는다", () => {
  const 둘: ServiceMenuEntry[] = [
    { id: "a", name: "개선요청", url: "/a" },
    { id: "b", name: "견적", url: "/b" },
  ];

  const initials = ["a", "b"].map((id) => {
    const html = renderToStaticMarkup(
      <ServiceMenuBar services={둘} currentServiceId={id} variant="inline" />
    );
    return /class="dss-menu__initial" aria-hidden="true">([^<]*)</.exec(
      summaryInner(html)
    )?.[1];
  });

  assert.deepEqual(initials, ["개", "견"]);
});

test("🔴 지금 있는 서비스를 몰라도 단추는 선다 — 목록을 펼칠 길이 사라지면 안 된다", () => {
  for (const html of [
    renderToStaticMarkup(<ServiceMenuBar services={SERVICES} variant="inline" />),
    renderToStaticMarkup(
      <ServiceMenuBar services={SERVICES} currentServiceId={null} variant="inline" />
    ),
    renderToStaticMarkup(
      <ServiceMenuBar services={SERVICES} currentServiceId="없는-서비스" variant="inline" />
    ),
  ]) {
    assert.equal(buttonName(html), "사내 시스템 바로가기", "단추에 설 이름이 없다");
    // 첫 글자를 딸 서비스가 없으므로 기본 아이콘 하나로 둔다 — "false" 로 두면
    // 폰에서 아이콘이 꺼지고 대신 켤 글자도 없어 빈 단추가 된다.
    assert.match(summaryTag(html), /data-has-icon="true"/);
    assert.equal(summaryInner(html).includes("dss-menu__initial"), false);
    assert.deepEqual(currentIds(html), [], "아무 칸도 눌리지 않는다");
    assert.equal(renderedIds(html).length, 3, "그래도 목록은 다 그린다");
  }
});

test("지금 서비스를 모를 때 단추에 서는 글자는 사이트가 준 label 이다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} variant="inline" label="서비스 이동" />
  );

  assert.equal(buttonName(html), "서비스 이동");
  assert.match(html, /<nav[^>]*aria-label="서비스 이동"/);
});

test("사이트가 준 className 은 새 모습에서도 맨 뒤에 붙는다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} variant="inline" className="shrink-0" />
  );

  assert.match(html, /class="dss-menu dss-menu--inline shrink-0"/);
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
    assert.equal(
      renderToStaticMarkup(
        <ServiceMenuBar
          services={[{ id: "evil", name: "나쁨", url: "javascript:x" }]}
          variant={variant}
        />
      ),
      "",
      `${variant}: 그릴 수 있는 칸이 없는데 빈 단추를 남겼다`
    );
  }
});

/* ── 폰에서 단추가 아이콘 하나로 줄어들 때 기대는 손잡이들 ───────────────── */

test("🔴 단추에 아이콘을 보일지 첫 글자를 보일지 CSS 가 고를 손잡이가 실려 있다", () => {
  const 아이콘있음 = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-as" variant="inline" />
  );
  const 아이콘없음 = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-improvements" variant="inline" />
  );

  assert.match(summaryTag(아이콘있음), /data-has-icon="true"/);
  assert.match(summaryTag(아이콘없음), /data-has-icon="false"/);

  // 단추의 아이콘 자리는 어느 쪽이든 정확히 하나다 — 둘이면 폰에서 겹친다.
  for (const html of [아이콘있음, 아이콘없음]) {
    assert.equal(
      [...summaryInner(html).matchAll(/class="dss-menu__icon"/g)].length,
      1
    );
  }
  // 첫 글자는 아이콘이 없는 쪽에만 실린다.
  assert.equal(summaryInner(아이콘있음).includes("dss-menu__initial"), false);
  assert.equal(
    [...summaryInner(아이콘없음).matchAll(/dss-menu__initial/g)].length,
    1
  );
});

test("🔴 목록 칸에도 예전의 손잡이가 그대로 남아 있다 — 기본 모습의 마크업을 지킨다", () => {
  // 이 값에 걸리는 CSS 는 이제 없다(판단이 단추로 옮겨 갔다). 그래도 마크업에서
  // 빼지 않는 이유는 하나뿐이다 — 기본 모습("bar")의 마크업을 글자 하나도
  // 바꾸지 않기로 한 약속. 세 사이트가 모두 새 모습으로 옮겨 간 뒤 걷어낸다.
  const html = renderToStaticMarkup(<ServiceMenuBar services={SERVICES} />);
  const flags = [...html.matchAll(/<a[^>]*data-has-icon="([^"]*)"/g)].map((m) => m[1]);

  // SERVICES 의 셋째(개선요청)만 icon 키가 없다.
  assert.deepEqual(flags, ["true", "true", "false"]);
  assert.equal([...html.matchAll(/class="dss-menu__initial"/g)].length, 1);
});

test("첫 글자는 낭독기에서 감춰진다 — 이름이 따로 읽히기 때문이다", () => {
  const html = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-improvements" variant="inline" />
  );

  assert.match(summaryInner(html), /<span class="dss-menu__initial" aria-hidden="true">/);
  // 아이콘도 마찬가지다 — 이모지가 "링크 이모지" 로 읽히면 방해만 된다.
  assert.match(summaryInner(html), /<span class="dss-menu__icon" aria-hidden="true">/);
});

test("🔴 이름은 두 모습 모두 마크업에 남는다 — 폰에서 감추는 것은 눈에서만이다", () => {
  for (const variant of ["bar", "inline"] as const) {
    const html = renderToStaticMarkup(
      <ServiceMenuBar services={SERVICES} currentServiceId="dss-meters" variant={variant} />
    );

    assert.deepEqual(
      renderedNames(html),
      ["A/S 관리", "계측기", "개선요청"],
      `${variant}: 이름이 마크업에서 사라졌다 — 낭독기가 이모지만 읽게 된다`
    );
  }

  // 단추의 이름도 마찬가지다. 폰에서는 눈에서만 감추고(CSS 의 clip) 마크업에는
  // 남는다 — 지우면 단추가 "링크 이모지 버튼" 으로만 읽힌다.
  const 드롭다운 = renderToStaticMarkup(
    <ServiceMenuBar services={SERVICES} currentServiceId="dss-meters" variant="inline" />
  );
  assert.equal(buttonName(드롭다운), "계측기");
});

test("이름 첫 글자 고르기 — 이모지를 반으로 쪼개지 않고, 빈 이름이어도 빈 칸을 남기지 않는다", () => {
  assert.equal(serviceInitial("개선요청"), "개");
  assert.equal(serviceInitial("  계측기 "), "계");
  assert.equal(serviceInitial("Quotes"), "Q");
  assert.equal(serviceInitial("🛠️도구"), "🛠", "서로게이트 쌍이 깨지면 안 된다");
  assert.equal(serviceInitial(""), DEFAULT_SERVICE_ICON, "빈 칸만은 남기지 않는다");
  assert.equal(serviceInitial("   "), DEFAULT_SERVICE_ICON);
});
