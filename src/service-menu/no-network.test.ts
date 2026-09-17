import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 🔴 이 묶음은 **네트워크를 타지 않는다** — 소스를 읽어 못 박는다.
 *
 * 왜 시험으로까지 막나: 이 조각을 다섯 사이트가 함께 쓴다. 언젠가 누군가
 * "메뉴 목록을 포털에서 직접 받아 오면 편하겠다"고 생각하는 날이 온다.
 * 그 한 줄이 들어가는 순간
 *   - 사이트마다 다른 인증 방식(쿠키 · 토큰 · 사내망 주소)에 묶이고,
 *   - 포털이 죽으면 다섯 화면의 머리말이 함께 느려지고,
 *   - 이 시험들이 브라우저·서버 없이 도는 지금 모양을 잃는다.
 * 사람의 기억 대신 시험이 막게 둔다. 정말로 필요해지면 이 파일의 목록을
 * 고치는 것이 그 결정을 **드러내 놓고** 하는 방법이다.
 *
 * 읽는 대상은 이 폴더의 소스 전부다. 새 파일이 늘어도 자동으로 걸린다.
 */

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url));

type SourceFile = { path: string; text: string };

function listSources(extensions: readonly string[]): SourceFile[] {
  return readdirSync(SRC_DIR, { recursive: true, encoding: "utf8" })
    .filter((name) => extensions.some((extension) => name.endsWith(extension)))
    .map((name) => ({
      path: name.replace(/\\/g, "/"),
      text: readFileSync(join(SRC_DIR, name), "utf8"),
    }));
}

/** 시험 파일을 뺀 것 — 실제로 사이트에 실려 나가는 코드. */
function runtimeSources(): SourceFile[] {
  return listSources([".ts", ".tsx"]).filter((file) => !file.path.includes(".test."));
}

/** import 문과 동적 import 에서 「무엇을 부르는지」만 뽑는다. */
function importedModules(text: string): string[] {
  const specifiers: string[] = [];
  for (const match of text.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+"([^"]+)"/g)) {
    specifiers.push(match[1]);
  }
  for (const match of text.matchAll(/(?:^|\n)\s*import\s+"([^"]+)"/g)) {
    specifiers.push(match[1]);
  }
  for (const match of text.matchAll(/(?:^|\n)\s*export\s[^;]*?from\s+"([^"]+)"/g)) {
    specifiers.push(match[1]);
  }
  for (const match of text.matchAll(/\bimport\(\s*"([^"]+)"/g)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

test("읽을 소스가 실제로 있다 — 목록이 비면 아래 시험이 전부 공짜로 통과한다", () => {
  assert.ok(runtimeSources().length >= 4, "src 아래 실사용 소스를 못 찾았다");
  assert.ok(listSources([".css"]).length >= 1, "스타일시트를 못 찾았다");
});

test("실사용 코드는 제 폴더 안과 react 말고는 아무것도 부르지 않는다", () => {
  // react 를 허용하되 next · 포털 클라이언트 · http 라이브러리는 막는다.
  // 이 목록이 짧게 유지되는 한, 이 묶음은 어느 사이트에도 묶이지 않는다.
  const allowed = new Set(["react", "react-dom", "react/jsx-runtime"]);

  for (const file of runtimeSources()) {
    for (const specifier of importedModules(file.text)) {
      const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
      assert.ok(
        isRelative || allowed.has(specifier),
        `${file.path} 가 ${specifier} 를 부른다 — 실사용 코드에서 허용하지 않는다`
      );
    }
  }
});

test("시험 코드도 밖으로 나가지 않는다", () => {
  const allowed = new Set([
    "node:test",
    "node:assert",
    "node:assert/strict",
    "node:fs",
    "node:path",
    "node:url",
    "react",
    "react-dom/server",
  ]);

  for (const file of listSources([".ts", ".tsx"]).filter((f) => f.path.includes(".test."))) {
    for (const specifier of importedModules(file.text)) {
      const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
      assert.ok(
        isRelative || allowed.has(specifier),
        `${file.path} 가 ${specifier} 를 부른다 — 시험은 파일과 react-dom 만으로 돈다`
      );
    }
  }
});

test("망을 타는 이름이 소스에 아예 없다", () => {
  // 이름만 막는 것으로 충분하다 — 자바스크립트에서 망을 타려면 결국
  // 이 중 하나를 불러야 한다.
  const forbidden = [
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

  // 이 파일 자신은 뺀다 — 금지어 목록이 여기 적혀 있어서 스스로에게 걸린다.
  // (목록을 쪼개 숨기는 편법 대신 한 줄로 드러내 두는 쪽을 골랐다)
  const files = listSources([".ts", ".tsx"]).filter(
    (file) => !file.path.endsWith("no-network.test.ts")
  );

  for (const file of files) {
    for (const name of forbidden) {
      assert.equal(
        file.text.includes(name),
        false,
        `${file.path} 에 ${name} 가 있다 — 이 묶음은 망을 타지 않는다`
      );
    }
  }
});

test("포털 주소도, 어떤 호스트 이름도 실사용 코드에 박혀 있지 않다", () => {
  // `"http://"` 같은 **접두사만** 있는 문자열(normalize 의 주소 검사)은
  // 통과하고, `https://portal.사내…` 처럼 실제 주소는 걸린다.
  // 주소를 박는 순간 이 묶음은 그 망에서만 도는 물건이 된다 —
  // 주소는 사이트가 제 설정(docs/주소.md)에서 풀어 넘긴다.
  const hardcodedHost = /https?:\/\/[A-Za-z0-9]/;

  for (const file of runtimeSources()) {
    const found = hardcodedHost.exec(file.text);
    assert.equal(found, null, `${file.path} 에 주소가 박혀 있다: ${found?.[0] ?? ""}`);
  }
});

test("환경변수도 읽지 않는다 — 설정은 전부 인자로 받는다", () => {
  for (const file of runtimeSources()) {
    assert.equal(file.text.includes("process.env"), false, `${file.path}`);
  }
});

test("스타일시트도 밖에서 무엇을 끌어오지 않는다", () => {
  for (const file of listSources([".css"])) {
    assert.equal(file.text.includes("@import"), false, `${file.path} 가 @import 를 쓴다`);
    assert.equal(
      /url\(\s*["']?https?:/.test(file.text),
      false,
      `${file.path} 가 바깥 주소에서 무언가를 받아온다 — 사내망에서는 뜨지 않는다`
    );
  }
});
