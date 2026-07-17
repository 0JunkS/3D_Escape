# 3D Escape — Android / Google Play 빌드 가이드

## 📋 목차
1. [사전 준비](#1-사전-준비)
2. [키스토어 생성 (최초 1회)](#2-키스토어-생성)
3. [방법 A: GitHub Actions 자동 빌드 (권장)](#3-방법-a-github-actions)
4. [방법 B: 로컬 PC에서 빌드](#4-방법-b-로컬-빌드)
5. [Google Play Store 업로드](#5-google-play-store-업로드)

---

## 1. 사전 준비

### GitHub Actions 사용 시 (방법 A)
- GitHub 계정 + 이 프로젝트를 push한 repository

### 로컬 빌드 시 (방법 B)
- [Android Studio](https://developer.android.com/studio) 설치
- JDK 17 (`JAVA_HOME` 환경변수 설정 필요)
- Node.js 20+, pnpm 10+

---

## 2. 키스토어 생성

> ⚠️ 키스토어는 **절대 분실하면 안 됩니다.** Play Store에 앱을 업로드한 후 동일 키로만 업데이트 가능합니다.

```bash
# 프로젝트 루트에서 실행
keytool -genkey -v \
  -keystore release.keystore \
  -alias key0 \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -dname "CN=3D Escape, OU=Game, O=YourCompany, L=Seoul, S=Seoul, C=KR"
```

생성 후 **`release.keystore`** 파일과 비밀번호를 안전한 곳에 백업하세요.

---

## 3. 방법 A: GitHub Actions 자동 빌드 (권장)

### 3-1. GitHub Secrets 설정

GitHub 저장소 → **Settings → Secrets and variables → Actions** 에서 추가:

| Secret 이름 | 값 |
|---|---|
| `RELEASE_KEYSTORE_BASE64` | `base64 -w0 release.keystore` 명령어 출력값 |
| `KEYSTORE_PASSWORD` | 키스토어 비밀번호 |
| `KEY_ALIAS` | `key0` |
| `KEY_PASSWORD` | 키 비밀번호 |

```bash
# Base64 인코딩 방법 (Linux/Mac)
base64 -w0 release.keystore

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore"))
```

### 3-2. 워크플로우 실행

GitHub 저장소 → **Actions → Build Android APK / AAB** → **Run workflow**

| 빌드 타입 | 결과물 | 용도 |
|---|---|---|
| `debug` (기본값) | `app-debug.apk` | 테스트용 직접 설치 |
| `release` | `app-release.aab` + `app-release.apk` | Play Store 업로드 |

빌드 완료 후 **Artifacts** 섹션에서 파일 다운로드.

---

## 4. 방법 B: 로컬 PC에서 빌드

```bash
# 1. 저장소 클론 후 의존성 설치
git clone <your-repo-url>
cd <project-root>
pnpm install

# 2. 웹앱 빌드
cd artifacts/game
BASE_PATH=/ NODE_ENV=production npx vite build

# 3. Android 동기화
npx cap sync android

# 4-A. 디버그 APK (빠른 테스트)
cd android
./gradlew assembleDebug
# 결과: android/app/build/outputs/apk/debug/app-debug.apk

# 4-B. 릴리즈 AAB (Play Store용)
KEYSTORE_PATH=../release.keystore \
KEYSTORE_PASSWORD=yourpass \
KEY_ALIAS=key0 \
KEY_PASSWORD=yourpass \
./gradlew bundleRelease
# 결과: android/app/build/outputs/bundle/release/app-release.aab
```

### Android Studio에서 빌드
```bash
npx cap open android   # Android Studio 자동 실행
```
Android Studio → **Build → Generate Signed Bundle / APK** 선택

---

## 5. Google Play Store 업로드

### 필수 자산 준비
- 앱 아이콘: 512×512 PNG (투명 배경 없음)
- 스크린샷: 최소 2장 (폰 / 태블릿)
- 피처 그래픽: 1024×500 PNG
- 개인정보처리방침 URL

### 업로드 순서
1. [Google Play Console](https://play.google.com/console) → **앱 만들기**
2. 앱 이름: **3D Escape**, 카테고리: **게임 → 퍼즐**
3. **프로덕션 → 새 버전 만들기** → AAB 파일 업로드
4. 버전 정보 입력 후 **검토 제출**

### 앱 ID (패키지명)
```
com.d3escape.game
```
> ⚠️ 한 번 Play Store에 등록하면 앱 ID 변경 불가

---

## 🔧 자주 묻는 문제

**Q. WebGL이 기기에서 안 열려요**  
A. Android 5.0+ 기기 필요. AndroidManifest에 `hardwareAccelerated="true"` 이미 설정됨.

**Q. 앱 크기가 너무 커요 (현재 ~120MB)**  
A. Three.js 번들이 큰 것이 원인. Play Store AAB 업로드 시 기기별 분할 배포로 자동 최적화.

**Q. 화면이 흰 화면으로 멈춰요**  
A. `capacitor.config.json`의 `webDir`가 `dist/public`으로 설정됐는지 확인.
