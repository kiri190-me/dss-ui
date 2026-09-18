import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DropdownDismiss,
  dismissAll,
  dismissOutside,
  watchDropdowns,
  type DropdownEventHost,
  type DropdownHandle,
} from "./DropdownDismiss";

/**
 * 바깥을 눌러 접기 · Esc 로 접기를 **브라우저 없이** 시험한다.
 *
 * 어떻게 브라우저 없이 되나: 접는 판단(누른 자리가 안인가 밖인가)과 사건을
 * 붙였다 떼는 일은 진짜 DOM 을 몰라도 되게 갈라 두었다 — DropdownHandle 과
 * DropdownEventHost 는 각각 「접을 수 있는 것」과 「사건을 듣는 곳」의 최소
 * 모양이고, 여기서는 가짜를 끼운다. 진짜 document 를 그 자리에 넣는 곳은
 * openDropdowns / DropdownDismiss 딱 두 군데다.
 *
 * 🔴 이 조각이 **없어도 메뉴는 돌아간다**는 것(펼침·접힘·링크)은 여기가
 *    아니라 ServiceMenuBar.test.tsx 가 마크업으로 못 박는다 — <details>·
 *    <summary>·<a href> 가 그대로인지, <script>·<button> 이 섞이지 않았는지.
 */

/** 누른 자리 — 진짜 DOM 마디가 아니어도 된다. 견주기만 한다. */
function 자리(): EventTarget {
  return {} as EventTarget;
}

/**
 * 접을 수 있는 가짜 드롭다운 하나.
 * `안쪽` 에 든 자리를 누른 것만 「안」으로 친다.
 */
function 가짜드롭다운(...안쪽: readonly EventTarget[]) {
  let 접힌횟수 = 0;

  const handle: DropdownHandle = {
    contains: (node) => node !== null && 안쪽.includes(node),
    close: () => {
      접힌횟수 += 1;
    },
  };

  return { handle, 접힌횟수: () => 접힌횟수 };
}

type 등록 = {
  type: string;
  listener: (event: Event) => void;
  options?: boolean | AddEventListenerOptions;
};

/** 사건을 듣는 가짜 곳. 무엇을 붙였고 무엇을 뗐는지 그대로 적어 둔다. */
function 가짜듣는곳() {
  const 붙인것: 등록[] = [];
  const 뗀것: 등록[] = [];

  const host: DropdownEventHost = {
    addEventListener: (type, listener, options) => {
      붙인것.push({ type, listener, options });
    },
    removeEventListener: (type, listener, options) => {
      뗀것.push({ type, listener, options });
    },
  };

  /**
   * 아직 붙어 있는 리스너에게만 사건을 넘긴다 — 뗀 것은 부르지 않는다.
   * 가짜 사건은 우리가 보는 두 칸(누른 자리 · 누른 키)만 갖는다.
   */
  const 일으킨다 = (
    type: string,
    event: { target?: EventTarget | null; key?: string }
  ) => {
    for (const 하나 of 붙인것) {
      if (하나.type !== type) continue;
      if (뗀것.some((x) => x.type === type && x.listener === 하나.listener)) continue;
      하나.listener(event as unknown as Event);
    }
  };

  return { host, 붙인것, 뗀것, 일으킨다 };
}

test("바깥을 누르면 접힌다", () => {
  const 드롭다운 = 가짜드롭다운(자리());

  dismissOutside([드롭다운.handle], 자리());

  assert.equal(드롭다운.접힌횟수(), 1);
});

test("🔴 드롭다운 **안**을 누른 것은 바깥이 아니다 — 목록을 굴리거나 링크를 눌러도 접히지 않는다", () => {
  const 목록안 = 자리();
  const 드롭다운 = 가짜드롭다운(목록안);

  dismissOutside([드롭다운.handle], 목록안);

  assert.equal(드롭다운.접힌횟수(), 0);
});

test("펼쳐진 것이 여럿이면 바깥인 것만 접는다", () => {
  const 누른자리 = 자리();
  const 눌린쪽 = 가짜드롭다운(누른자리);
  const 딴쪽 = 가짜드롭다운();

  dismissOutside([눌린쪽.handle, 딴쪽.handle], 누른자리);

  assert.equal(눌린쪽.접힌횟수(), 0);
  assert.equal(딴쪽.접힌횟수(), 1);
});

test("누른 자리를 알 수 없으면(target 이 없으면) 바깥으로 친다", () => {
  const 드롭다운 = 가짜드롭다운(자리());

  dismissOutside([드롭다운.handle], null);

  assert.equal(드롭다운.접힌횟수(), 1);
});

test("Esc 는 펼쳐진 것을 전부 접는다 — 안이든 바깥이든 가리지 않는다", () => {
  const 하나 = 가짜드롭다운();
  const 둘 = 가짜드롭다운(자리());

  dismissAll([하나.handle, 둘.handle]);

  assert.equal(하나.접힌횟수(), 1);
  assert.equal(둘.접힌횟수(), 1);
});

test("🔴 폰까지 한 번에 받으려고 pointerdown 을 듣는다 — click 은 iOS 에서 문서까지 오지 않는다", () => {
  const 듣는곳 = 가짜듣는곳();

  watchDropdowns(듣는곳.host, () => []);

  assert.deepEqual(
    듣는곳.붙인것.map((하나) => 하나.type).sort(),
    ["keydown", "pointerdown"],
    "마우스·손가락·펜을 한 번에 받는 pointerdown 과 Esc 를 받는 keydown 둘이다"
  );
  // 중간에서 누가 stopPropagation 을 불러도 듣는다. 우리는 preventDefault 를
  // 하지 않으므로 먼저 듣는 것이 사이트 동작을 가로채지 않는다.
  for (const 하나 of 듣는곳.붙인것) {
    assert.deepEqual(하나.options, { capture: true }, `${하나.type} 를 capture 로 안 듣는다`);
  }
});

test("붙인 뒤에는 바깥을 누르면 접히고, Esc 로도 접힌다", () => {
  const 바깥 = 자리();
  const 드롭다운 = 가짜드롭다운();
  const 듣는곳 = 가짜듣는곳();

  watchDropdowns(듣는곳.host, () => [드롭다운.handle]);

  듣는곳.일으킨다("pointerdown", { target: 바깥 });
  assert.equal(드롭다운.접힌횟수(), 1);

  듣는곳.일으킨다("keydown", { key: "Escape" });
  assert.equal(드롭다운.접힌횟수(), 2);
});

test("Esc 말고 다른 키는 아무 일도 하지 않는다 — 글자를 치다 메뉴가 접히면 안 된다", () => {
  const 드롭다운 = 가짜드롭다운();
  const 듣는곳 = 가짜듣는곳();

  watchDropdowns(듣는곳.host, () => [드롭다운.handle]);

  for (const key of ["Enter", "Tab", "e", "Esc", " "]) {
    듣는곳.일으킨다("keydown", { key });
  }

  assert.equal(드롭다운.접힌횟수(), 0);
});

test("🔴 사건이 올 때마다 지금 펼쳐진 것을 다시 찾는다 — 한 번 붙잡아 두지 않는다", () => {
  let 찾은횟수 = 0;
  const 듣는곳 = 가짜듣는곳();

  watchDropdowns(듣는곳.host, () => {
    찾은횟수 += 1;
    return [];
  });

  assert.equal(찾은횟수, 0, "붙이는 것만으로 화면을 뒤지지 않는다");

  듣는곳.일으킨다("pointerdown", { target: 자리() });
  듣는곳.일으킨다("pointerdown", { target: 자리() });
  듣는곳.일으킨다("keydown", { key: "Escape" });

  assert.equal(찾은횟수, 3, "메뉴바는 다시 그려질 수 있다 — 그때마다 새로 찾아야 한다");
});

test("🔴 붙인 것을 **전부** 떼어낸다 — 같은 함수, 같은 옵션으로", () => {
  const 듣는곳 = 가짜듣는곳();

  const 뒷정리 = watchDropdowns(듣는곳.host, () => []);
  assert.equal(듣는곳.뗀것.length, 0, "아직 뗄 때가 아니다");

  뒷정리();

  // 붙인 것과 뗀 것이 하나하나 짝이 맞아야 한다. 옵션(capture)이 다르면
  // 브라우저는 다른 리스너로 보고 떼지 않는다 — 그래서 옵션까지 대조한다.
  assert.deepEqual(듣는곳.뗀것, 듣는곳.붙인것);
  for (const 붙인 of 듣는곳.붙인것) {
    assert.ok(
      듣는곳.뗀것.some((뗀) => 뗀.type === 붙인.type && 뗀.listener === 붙인.listener),
      `${붙인.type} 리스너가 화면에 남는다 — 화면을 오갈수록 쌓인다`
    );
  }
});

test("뒷정리한 뒤에는 눌러도 접히지 않는다", () => {
  const 드롭다운 = 가짜드롭다운();
  const 듣는곳 = 가짜듣는곳();

  watchDropdowns(듣는곳.host, () => [드롭다운.handle])();

  듣는곳.일으킨다("pointerdown", { target: 자리() });
  듣는곳.일으킨다("keydown", { key: "Escape" });

  assert.equal(드롭다운.접힌횟수(), 0);
});

test("펼쳐진 것이 하나도 없으면 아무 일도 하지 않는다", () => {
  const 듣는곳 = 가짜듣는곳();

  watchDropdowns(듣는곳.host, () => []);

  assert.doesNotThrow(() => {
    듣는곳.일으킨다("pointerdown", { target: 자리() });
    듣는곳.일으킨다("keydown", { key: "Escape" });
  });
});

test("🔴 그리는 것이 없다 — 마크업이 한 글자도 늘지 않는다", () => {
  assert.equal(renderToStaticMarkup(<DropdownDismiss />), "");
});

test("🔴 서버에서 그려도 터지지 않는다 — 그리는 동안에는 화면의 물건을 만지지 않는다", () => {
  // node 에는 document 가 아예 없다. 그리는 동안 그것을 만지는 코드가
  // 한 줄이라도 있으면 이 시험이 바로 빨개진다.
  assert.equal(typeof globalThis.document, "undefined", "이 시험의 전제가 깨졌다");
  assert.doesNotThrow(() => renderToStaticMarkup(<DropdownDismiss />));
});
