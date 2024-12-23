mkdir im-app
cd im-app
pnpm init 

mkdir -p packages/client/src/{assets,components,pages,stores,services,types}
mkdir -p packages/server/src/{config,controllers,models,routes,services,types}
mkdir -p shared/src/types

cd packages/client
pnpm create vite . --template react-ts
cd ../..

# 创建必要的前端文件