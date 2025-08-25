// assets/javascripts/discourse/initializers/lottery-preview.js

import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-preview-decorator",
  initialize() {
    withPluginApi("0.8.31", (api) => {
      // 将 [lottery]...[/lottery] 占位转为卡片 HTML
      function renderLotteryCard(raw) {
        const match = raw.match(/\[lottery\]([\s\S]*?)\[\/lottery\]/m);
        if (!match) return null;
        const content = match[1];

        // 解析内容
        const data = {};
        content.split('\n').forEach((line) => {
          if (!line.trim()) return;
          if (line.includes('：')) {
            const [key, value] = line.split('：', 2);
            switch (key.trim()) {
              case '活动名称':
                data.prize_name = value.trim();
                break;
              case '奖品说明':
                data.prize_details = value.trim();
                break;
              case '开奖时间':
                data.draw_time = value.trim();
                break;
              case '获奖人数':
                data.winners_count = value.trim();
                break;
              case '指定楼层':
                data.specified_posts = value.trim();
                break;
              case '参与门槛':
                data.min_participants = value.trim();
                break;
              case '补充说明':
                data.additional_notes = value.trim();
                break;
              case '奖品图片':
                data.prize_image = value.trim();
                break;
            }
          }
        });

        // 状态假定为 running，预览时没有后端信息
        const status_class = "lottery-status-running";
        const status_text = "🏃 进行中";
        // 时间美化
        const drawTime = data.draw_time || "";
        // 抽奖方式
        let method = "";
        if (data.specified_posts) {
          method = `指定楼层 (${data.specified_posts})`;
        } else if (data.winners_count) {
          method = `随机抽取 ${data.winners_count} 人`;
        }

        // 拼接最终HTML
        return `
  <div class="lottery-display-card ${status_class}">
    <div class="lottery-header">
      <div class="lottery-title">
        <span class="lottery-icon">🎲</span>
        <h3>${data.prize_name || ""}</h3>
      </div>
      <div class="lottery-status">${status_text}</div>
    </div>
    <div class="lottery-content">
      ${data.prize_image ? `
        <div class="lottery-image">
          <img src="${data.prize_image}" alt="奖品图片" />
        </div>` : ""}
      <div class="lottery-details">
        <div class="lottery-detail-item">
          <span class="label">🎁 奖品说明：</span>
          <span class="value">${data.prize_details || ""}</span>
        </div>
        <div class="lottery-detail-item">
          <span class="label">⏰ 开奖时间：</span>
          <span class="value">${drawTime}</span>
        </div>
        <div class="lottery-detail-item">
          <span class="label">🎯 抽奖方式：</span>
          <span class="value">${method}</span>
        </div>
        <div class="lottery-detail-item">
          <span class="label">👥 参与门槛：</span>
          <span class="value">${data.min_participants ? `至少 ${data.min_participants} 人参与` : ""}</span>
        </div>
        ${data.additional_notes ? `
          <div class="lottery-detail-item">
            <span class="label">📝 补充说明：</span>
            <span class="value">${data.additional_notes}</span>
          </div>
        ` : ""}
      </div>
    </div>
    <div class="lottery-footer">
      <div class="participation-tip">
        💡 <strong>参与方式：</strong>在本话题下回复即可参与抽奖
      </div>
    </div>
  </div>
        `;
      }

      // 注册预览区渲染器
      api.decorateCookedElement(
        (elem, helper) => {
          // 只在预览区工作
          if (!helper || !helper.getModel || !helper.getModel().composer) return;

          const parent = elem.parentElement;
          if (!parent) return;

          // 查找 lottery 占位块
          const blocks = elem.querySelectorAll("p");
          blocks.forEach((p) => {
            const text = p.textContent;
            if (text && /\[lottery\][\s\S]*?\[\/lottery\]/m.test(text)) {
              const raw = text;
              const html = renderLotteryCard(raw);
              if (html) {
                const temp = document.createElement("div");
                temp.innerHTML = html;
                p.replaceWith(temp.firstElementChild);
              }
            }
          });
        },
        { id: "lottery-preview", onlyStream: false, afterCook: true }
      );
    });
  },
};
