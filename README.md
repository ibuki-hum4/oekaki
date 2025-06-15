# リアルタイム共同お絵描きアプリ 🎨

リアルタイムで複数人が同時にお絵描きができるWebアプリケーションです。
Socket.IOを使用して、リアルタイムな描画の共有を実現しています。

## 機能 ✨

- リアルタイムな共同お絵描き
- ルーム作成・参加機能
  - 公開/非公開/個人用ルーム
  - 招待機能
- ブラシサイズ・カラー選択
- 消しゴム機能
- キャンバスクリア
- 画像として保存
- ユーザー数表示

## 技術スタック 🛠️

- Next.js (フロントエンド)
- Node.js + Express + Socket.IO (バックエンド)
- Material-UI (UIコンポーネント)

## ローカル開発手順 🚀

1. リポジトリをクローン
```bash
git clone https://github.com/ibuki-hum4/oekaki.git
cd drawing-app-nextjs
```

2. 依存パッケージのインストール
```bash
# フロントエンド
npm install

# バックエンド
cd server
npm install
```

3. 開発サーバーの起動
```bash
# バックエンド (server/ディレクトリで)
npm start

# フロントエンド (プロジェクトルートで)
npm run dev
```

4. ブラウザで開く
- http://localhost:3000 にアクセス

## デプロイ方法 🌐

### フロントエンド（Vercel）

1. GitHubリポジトリをVercelにインポート
2. 環境変数の設定:
   - `NEXT_PUBLIC_SERVER_URL`: Railway側のURL（例: https://your-app.railway.app）

### バックエンド（Railway）

1. GitHubリポジトリをRailwayにインポート（`server`ディレクトリを指定）
2. 環境変数の設定:
   - `FRONTEND_URL`: Vercel側のURL（例: https://your-app.vercel.app）

## ライセンス 📝

MITライセンス
