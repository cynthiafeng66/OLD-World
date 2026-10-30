# 暖阳厨房 · 当前修订

双击 **启动厨房.command**，或打开 http://127.0.0.1:8766/ 。预览使用本机文件，运行时不访问外网。

已加入**摄像头控刀**：右侧点击「开启摄像头」，四指并拢伸直可控制虚拟刀；识别纸板刀、玩具刀或长条道具时，先移开手和道具，点击「采集空背景」后再放入。刀柄跟随位置、刀尖跟随方向，并显示挥动轨迹。详见 [控刀代码与使用说明](knife-control/README.md)。道具识别基于长条轮廓，需固定镜头及对比明显的背景；当前输出二维轨迹，尚未添加砍切玩法。

Kitchen 2 现已按本轮请求修正灶台局部，见末尾“灶台局部修正”；其余部位保留原始数据。此前按用户要求将 kitchen 2、左侧木柜和烤箱高柜也恢复为完整原始模型，原始几何、UV、材质与贴图不变，只调整等比例尺寸、整体位置和朝向。以下保留此前已完成的窗户修订：

- 左侧木柜绕 Y 轴旋转 90°，背面靠左墙，开口朝房间内部。已检查墙面、踢脚线、后排厨房和中央桌子的间距，无交叠。
- 从 `assets/models/table 3d model.glb` 工作模型中删除附带的窗户，仅保留木桌；剩余顶点、UV、法线、原始贴图均保留。修改前备份位于 `assets/originals/table-with-window-original.glb`，桌面原件未改动。
- 删除之前的独立窗景部件，以及场景里被拆分、拉伸的冰箱、后排橱柜、碗碟架、补柜和补充盘子。
- 直接载入 `assets/models/kitchen 1 3d model.glb` 完整原始文件。源文件与桌面原件逐字节一致；仅在父级施加等比例缩放和整体位移，不拆分、不简化、不更换材质。
- 在 kitchen 1 自带窗框内增加独立画面，使用用户上传的 `assets/images/window-landscape.png`。图片按窗洞比例裁切显示，不覆盖原模型纹理。
- 撤销先前对模型材质法线强度和地板颜色的修改，使用各模型原材质与贴图。

## 文件

- `output/warm-kitchen.glb`：更新后的整屋模型，家具为独立命名分组。
- `output/kitchen-clean.png`：无界面的实际渲染预览。
- `output/kitchen-room.png`：含操作界面的实际预览。
- `output/source-integrity.json`：验证四个完整原模型源文件及导出后的顶点、UV、法线、索引和贴图图像字节一致。
- `output/spatial-check.json`：左柜和墙体、踢脚线、厨房、桌子的间距检查。
- `output/validation.json`：页面载入、编辑、还原、参考图开关和导出验证。
- `assets/models/`：工作模型；其中 kitchen 1 为完整原文件，table 已按要求删除窗户。
- `assets/parts/`：其余已拆分素材和当前清单。

## 使用

「编辑部件」可修改家具的整体位置、角度、缩放和显示状态。Kitchen 1、Kitchen 2、左侧木柜和烤箱高柜直接载入各自完整原始 GLB，保持模型内部关系及原始长宽高比例；Kitchen 2 的灶台与抽油烟机不再拆开。编辑这些原模型时，XYZ 缩放自动联动，避免拉伸。

「保存布局／载入布局」导出或恢复 JSON；「保存图片」输出 PNG；「导出 GLB」保存当前可见场景。GLB 导出时专门复制 kitchen 1、kitchen 2、左侧木柜与烤箱高柜的原始二进制数据，保留原始网格及编码贴图，不重采样或重压缩这些贴图。已导出的 GLB 也经过逐字节比对。

光照和阴影由预览场景提供，不烘焙进原模型贴图。GLB 不包含浏览器环境光和地面叠加窗光，导入其他软件后需设置灯光。

拆分素材仍保留原有 UV 和贴图。模型本身来自生成式网格，部分边缘不规则。补充墙体、天花板、踢脚线为独立建筑几何。

Three.js、meshoptimizer 及许可证位于 `vendor/`。`scripts/remove-table-window.mjs` 从原始备份重建无窗桌子；`scripts/prepare-models.mjs` 整理其他素材，并跳过上述四个完整原模型的拆分和简化；`scripts/verify-source-integrity.mjs` 可重新核对源文件与整屋导出。


## 从 GitHub 获取完整项目

模型文件通过 Git LFS 保存。先安装 Git 和 Git LFS，再执行：

```sh
git lfs install
git clone https://github.com/cynthiafeng66/OLD-World.git
cd OLD-World
git lfs pull
python3 -m http.server 8766 --bind 127.0.0.1
```

打开 http://127.0.0.1:8766/ 。macOS 也可以双击 `启动厨房.command`。

Three.js 和模型加载器已随项目放入 `vendor/`，运行预览不需要 npm 安装。`output/warm-kitchen.glb` 是当前整屋模型；左侧木柜已沿左墙向前挪动，与冰箱拉开距离。模型、贴图和原始备份都在 `assets/` 中。


## 灶台局部修正

Kitchen 2 已修正原网格中变形的炉架、方块部件、裸露管件和红色阀门，替换为双炉头、铸铁四向锅架、黑色圆角灶面，不带旋钮；炉头已前移到靠近台面前沿的位置。只裁掉灶台上方指定区域的旧三角面；橱柜、木台面、防溅墙砖及抽油烟机的原始顶点、UV、法线、材质和贴图图像数据保留。原始 `assets/models/kitchen 2 3d model.glb` 仍保留。

当前场景直接加载完整的 `assets/models/kitchen 2 stove fixed.glb`；`output/kitchen-2-repaired.glb` 是相同的独立 kitchen 2 模型，包含修正后的灶台，可直接导入三维软件。`output/warm-kitchen.glb` 已同步。

`stove.js` 生成新的炉头、锅架和灶面。先运行 `node scripts/repair-stove.mjs`，再运行 `node scripts/build-repaired-stove.mjs` 可重新生成修正模型；中间文件 `assets/originals/kitchen-2-stove-cleared.glb` 只用于构建。

`output/stove-closeup.png` 为近景，`output/stove-validation.json` 为页面与导出验证，`output/stove-repair.json` 记录了旧网格裁切区域。


## Prep table and English interface

The original white cutting board (`cutting board 3d model.glb`) is now on the front-center of the wooden worktable, using its original proportions and textures. The hob has no knobs or buttons, and both burners are closer to the front edge for easier reach.

All in-game interface text is English, including the room editor, loading states, errors, layout dialogs, camera controls, calibration messages and tracking overlays. The exported room includes the cutting board and the updated hob.

`output/prep-layout-validation.json` checks board support and table bounds, burner reach and English UI text; `output/knife-input-validation.json` checks simulated camera states and mobile controls.

## Corner completion

The gap between the sink run and hob run is filled with a corner cabinet, a solid wooden counter closure and green tiles returning along the right wall. Added faces reuse the original kitchen atlas and materials; existing furniture geometry, placement, proportions and textures are unchanged. `scripts/prepare-corner.mjs` builds `assets/models/kitchen-corner-completion.glb`. The new part is included in editing, layouts and full-room GLB export.

## Clean game interface

Loading messages and camera controls are in English. The top-left branding, reference overlay, bottom navigation/actions and navigation hint have been removed. The camera panel uses translucent white glass with dark text. Room navigation still works through mouse/touch OrbitControls; `window.kitchen.exportRoom()` remains available for development exports.

## Live website

[Open Old World Kitchen](https://cynthiafeng66.github.io/OLD-World/). Pushing to `main` deploys through `.github/workflows/pages.yml`. The workflow fetches the runtime models from Git LFS and packages their actual bytes with `scripts/build-pages.py`; source backups, full-room exports and private local reference photos are not included in the hosted site. Original model textures are copied without conversion.

## Dough stages on the brown board

The brown baking board starts with the round dough model. With the kitchen scene focused, press Space once to cycle through round, oval, irregular and flattened dough, then back to round dough. Holding Space does not skip stages. Camera controls keep their keyboard behavior. The four source models are preserved in `assets/models/`; lightweight previews retain the exact original texture image bytes. `scripts/prepare-dough-stages.mjs` rebuilds those previews and `scripts/check-dough-sequence.cjs` verifies placement and keyboard transitions.
