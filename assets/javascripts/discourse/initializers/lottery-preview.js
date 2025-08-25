// discourse-lottery-v3: assets/javascripts/discourse/initializers/lottery-preview.js

import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-preview",

  initialize() {
    withPluginApi("0.8", api => {
      api.decorateCookedElement(
        (elem, helper) => {
          // ------ 安全容错，非编辑器预览区直接跳过 ------
          if (!helper || typeof helper.getModel !== "function") return;
          const model = helper.getModel?.();
          if (!model || !model.composer) return;

          // ------ 只在编辑器预览区查找 lottery 卡片标记块 ------
          elem.querySelectorAll(".lottery-raw").forEach(rawEl => {
            // 清除旧的卡片（避免多次渲染）
            let next = rawEl.nextElementSibling;
            if (next && next.classList.contains("lottery-card-preview")) {
              next.remove();
            }

            // 这里你可以移植“后端”对数据的解析逻辑，举例（需替换为你插件实际格式）：
            // 假设 [lottery]content[/lottery] 已被 cooked 替换为 <div class="lottery-raw">content</div>
            const content = rawEl.textContent || "";

            // 生成一个很简单的卡片（请按实际美化与结构定制）
            const card = document.createElement("div");
            card.className = "lottery-card-preview";
            card.innerHTML = `
              <div style="border:1px solid #aac;padding:12px;margin:8px 0;border-radius:6px;background:#eef">
                <strong>Lottery Card:</strong><br>
                ${content}
              </div>
            `;

            // 插到原 .lottery-raw 后面
            rawEl.insertAdjacentElement("afterend", card);
          });
        },
        { id: "lottery-preview", onlyStream: false, afterCook: true }
      );
    });
  },
};
