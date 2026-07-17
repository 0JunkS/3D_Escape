# 3D Escape

3D 퍼즐 방탈출 게임. Three.js(CDN)와 Firebase로 구동되며, Capacitor를 통해 Android APK/AAB로 패키징됩니다.

## Run & Operate

- `pnpm --filter @workspace/game run dev` — 게임 서버 실행 (포트 24631)
- `pnpm --filter @workspace/api-server run dev` — API 서버 실행 (포트 5000)
- `bash scripts/generate-keystore.sh` — 릴리즈 키스토어 생성 (PC에서 1회만)
- GitHub Actions → Build Android APK / AAB → Run workflow

## Stack

- 게임: 순수 HTML/JS + Three.js 0.168 (CDN) + Firebase 10 (CDN)
- Dev server: Node.js HTTP (Vite 없음 — importmap CDN 호환)
- Android 래퍼: Capacitor 6
- 빌드: GitHub Actions (ubuntu-latest)
- 패키지명: `com.d3escape.game`

## Where things live

- `artifacts/game/index.html` — 게임 전체 (HTML/CSS/JS 인라인)
- `artifacts/game/server.js` — dev용 단순 HTTP 서버
- `artifacts/game/capacitor.config.json` — Capacitor 설정
- `.github/workflows/build-android.yml` — Android 빌드 파이프라인
- `scripts/generate-keystore.sh` — 릴리즈 키스토어 생성 스크립트

## Android APK/AAB 빌드 절차

### 사전 준비 (최초 1회)
1. 이 프로젝트를 GitHub에 push
2. PC 터미널에서 `bash scripts/generate-keystore.sh` 실행
3. GitHub 저장소 Settings → Secrets and variables → Actions 에서 추가:
   - `RELEASE_KEYSTORE_BASE64` — 스크립트가 출력하는 base64 값
   - `KEYSTORE_PASSWORD` — 키스토어 비밀번호
   - `KEY_ALIAS` — `key0`
   - `KEY_PASSWORD` — 키 비밀번호

### 빌드 실행
- GitHub → Actions → **Build Android APK / AAB** → **Run workflow**
- `debug` → `app-debug.apk` (테스트 직접 설치용)
- `release` → `app-release.aab` (Google Play Store 업로드용) + APK

### Google Play Store 업로드
1. [Google Play Console](https://play.google.com/console) → 앱 만들기
2. 앱 이름: **3D Escape**, 카테고리: 게임 → 퍼즐
3. 프로덕션 → 새 버전 만들기 → AAB 업로드
4. 버전 정보 입력 후 검토 제출

## Architecture decisions

- Three.js와 Firebase를 CDN에서 로드하므로 Vite 번들러 대신 단순 Node.js HTTP 서버를 사용. importmap이 Vite의 모듈 해석과 충돌하기 때문.
- GitHub Actions에서 `npx cap add android`로 Android 프로젝트를 CI 시점에 생성 — Android 프로젝트 파일을 저장소에 커밋할 필요 없음.
- 릴리즈 서명은 `-P` Gradle 플래그로 전달 — 생성된 build.gradle 수정 불필요.

## User preferences

- 패키지명 `com.d3escape.game` — Play Store 등록 후 변경 불가

## Gotchas

- `release.keystore`는 절대 GitHub에 커밋하지 말 것 (.gitignore에 포함됨)
- 키스토어를 분실하면 Play Store에서 앱을 업데이트할 수 없음 — 반드시 백업
- `npx cap add android`는 `dist/public/index.html`이 존재해야 동작함
