import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 🔴 **종도 네트워크를 타지 않는다** — 이 폴더의 소스를 읽어 못 박는다.
 *
 * 왜 종에서 한 번 더 막나: 메뉴바에도 같은 시험이 있고 그것이 src 아래를 전부
 * 훑으므로 이 파일이 없어도 걸리기는 한다. 그래도 여기에 둔다 — **유혹이 바로
 * 여기 있기 때문이다.** 알림은 메뉴 목록과 달리 시시각각 바뀌는 값이라,
 * 언젠가 누군가 "종이 포털에 직접 물어보면 되지 않나"라고 생각하는 날이 온다.
 * 그 한 줄이 들어가는 순간
 *   - 사이트마다 다른 인증 방식(쿠키 · 토큰 · 사내망 주소)에 묶이고,
 *   - 포털이 죽으면 다섯 화면의 머리말이 함께 느려지고,
 *   - 이 시험들이 브라우저·서버 없이 도는 지금 모양을 잃는다.
 * 사람의 기억 대신 시험이 막게 둔다. 정말로 필요해지면 이 파일을 고치는 것이
 * 그 결정을 **드러내 놓고** 하는 방법이다.
 */

const 폴더 = fileURLToPath(new URL(".", import.meta.url));

type 소스 = { path: string; text: string };

function 훑는다(확장자: readonly string[]): 소스[] {
  return readdirSync(폴더, { recursive: true, encoding: "utf8" })
    .filter((name) => 확장자.some((하나) => name.endsWith(하나)))
    .map((name) => ({
      path: name.replace(/\\/g, "/"),
      text: readFileSync(join(폴더, name), "utf8"),
    }));
}

/** 시험 파일을 뺀 것 — 실제로 사이트에 실려 나가는 코드. */
function 실사용(): 소스[] {
  return 훑는다([".ts", ".tsx"]).filter((file) => !file.path.includes(".test."));
}

/** import 문과 동적 import 에서 「무엇을 부르는지」만 뽑는다. */
function 부르는것(text: string): string[] {
  const 목록: string[] = [];
  for (const match of text.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+"([^"]+)"/g)) {
    목록.push(match[1]);
  }
  for (const match of text.matchAll(/(?:^|\n)\s*import\s+"([^"]+)"/g)) {
    목록.push(match[1]);
  }
  for (const match of text.matchAll(/\bimport\(\s*"([^"]+)"/g)) {
    목록.push(match[1]);
  }
  return 목록;
}

test("읽을 소스가 실제로 있다 — 목록이 비면 아래 시험이 전부 공짜로 통과한다", () => {
  assert.ok(실사용().length >= 4, "종 폴더에서 실사용 소스를 못 찾았다");
  assert.ok(훑는다([".css"]).length >= 1, "스타일시트를 못 찾았다");
});

test("🔴 실사용 코드는 **제 폴더 안**과 react 말고는 아무것도 부르지 않는다", () => {
  // react 를 허용하되 next · 포털 클라이언트 · http 라이브러리는 막는다.
  const 허용 = new Set(["react", "react-dom", "react/jsx-runtime"]);

  for (const file of 실사용()) {
    for (const 부름 of 부르는것(file.text)) {
      // 🔴 `../` 도 막는다 — 옆 폴더(메뉴바)를 부르지 않는다는 뜻이다. 그
      //    조각은 세 사이트가 이미 싣고 있어서, 새 조각이 그 안을 붙들면
      //    그쪽을 고칠 때마다 이쪽이 함께 흔들린다. 조각끼리 서로를 부르지
      //    않는 편이 그 둘을 따로 고칠 수 있게 한다.
      const 제폴더 = 부름.startsWith("./");
      assert.ok(
        제폴더 || 허용.has(부름),
        `${file.path} 가 ${부름} 를 부른다 — 종은 제 폴더와 react 만으로 돈다`
      );
    }
  }
});

test("망을 타는 이름이 소스에 아예 없다", () => {
  // 이름만 막는 것으로 충분하다 — 자바스크립트에서 망을 타려면 결국 이 중
  // 하나를 불러야 한다. (이 파일 자신은 아래에서 빼고 본다 — 목록이 여기
  // 적혀 있어서 스스로에게 걸린다.)
  const 금지 = [
    "fetch(",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "sendBeacon",
    "navigator.",
    "axios",
    "location.href",
    "window.open",
  ];

  const 볼것 = 훑는다([".ts", ".tsx"]).filter(
    (file) => !file.path.endsWith("no-network.test.ts")
  );

  for (const file of 볼것) {
    for (const 이름 of 금지) {
      assert.equal(
        file.text.includes(이름),
        false,
        `${file.path} 에 ${이름} 가 있다 — 종은 망을 타지 않는다`
      );
    }
  }
});

test("포털 주소도, 어떤 호스트 이름도 실사용 코드에 박혀 있지 않다", () => {
  // `"http://"` 같은 **접두사만** 있는 문자열(normalize 의 주소 검사)은
  // 통과하고, 실제 주소는 걸린다. 주소는 사이트가 제 설정에서 풀어 넘긴다.
  const 박힌주소 = /https?:\/\/[A-Za-z0-9]/;

  for (const file of 실사용()) {
    const 찾음 = 박힌주소.exec(file.text);
    assert.equal(찾음, null, `${file.path} 에 주소가 박혀 있다: ${찾음?.[0] ?? ""}`);
  }
});

test("환경변수도 읽지 않는다 — 설정은 전부 prop 으로 받는다", () => {
  for (const file of 실사용()) {
    assert.equal(file.text.includes("process.env"), false, `${file.path}`);
  }
});

test("스타일시트도 밖에서 무엇을 끌어오지 않는다", () => {
  for (const file of 훑는다([".css"])) {
    assert.equal(file.text.includes("@import"), false, `${file.path} 가 @import 를 쓴다`);
    assert.equal(
      /url\(\s*["']?https?:/.test(file.text),
      false,
      `${file.path} 가 바깥 주소에서 무언가를 받아온다 — 사내망에서는 뜨지 않는다`
    );
  }
});
