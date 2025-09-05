// assets/javascripts/discourse/initializers/lottery-composer-integration.js
// 实用版本 - 直接为抽奖插件设计

import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-composer-integration",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 Lottery: 初始化实用工具栏");

      const siteSettings = api.container.lookup("service:site-settings");
      
      if (!siteSettings.lottery_enabled) {
        return;
      }

      // 检查分类权限
      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) return false;

        const allowedCategories = siteSettings.lottery_allowed_categories;
        if (!allowedCategories) return true;

        const allowedIds = allowedCategories.split("|").map(id => Number(id.trim())).filter(id => !isNaN(id) && id > 0);
        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        return allowedIds.length === 0 || allowedIds.includes(currentCategoryId);
      }

      // 添加工具栏按钮
      api.onToolbarCreate((toolbar) => {
        toolbar.addButton({
          title: "插入抽奖",
          id: "insertLottery", 
          group: "extras",
          icon: "dice",
          perform: (e) => {
            console.log("🎲 工具栏按钮点击");
            
            if (!siteSettings.lottery_enabled) {
              showAlert("抽奖功能已被管理员关闭");
              return;
            }

            if (!canInsertLottery()) {
              showAlert("当前分类不支持抽奖功能");
              return;
            }

            // 显示抽奖表单
            showLotteryForm(e);
          }
        });
      });

      // 简单的提示框
      function showAlert(message) {
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        `;
        
        modal.innerHTML = `
          <div style="
            background: var(--secondary);
            color: var(--primary);
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            max-width: 400px;
            margin: 20px;
          ">
            <div style="margin-bottom: 20px; font-size: 16px;">${message}</div>
            <button onclick="this.closest('div').remove()" style="
              background: var(--tertiary);
              color: var(--secondary);
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
            ">确定</button>
          </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.remove();
        });
      }

      // 显示抽奖表单
      function showLotteryForm(toolbarEvent) {
        console.log("🎲 显示抽奖表单");
        
        // 移除已存在的表单
        const existing = document.querySelector('.lottery-form-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'lottery-form-modal';
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        `;

        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const defaultTime = tomorrow.toISOString().slice(0, 16);

        modal.innerHTML = `
          <div style="
            background: var(--secondary);
            color: var(--primary);
            padding: 30px;
            border-radius: 8px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            margin: 20px;
          ">
            <h3 style="margin: 0 0 20px 0; text-align: center;">创建抽奖活动</h3>
            
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">活动名称 *</label>
              <input id="prize-name" type="text" placeholder="例如：iPhone 15 Pro 抽奖" style="
                width: 100%;
                padding: 8px;
                border: 1px solid var(--primary-low);
                border-radius: 4px;
                background: var(--secondary);
                color: var(--primary);
              ">
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">奖品说明 *</label>
              <textarea id="prize-details" placeholder="详细描述奖品内容" rows="3" style="
                width: 100%;
                padding: 8px;
                border: 1px solid var(--primary-low);
                border-radius: 4px;
                background: var(--secondary);
                color: var(--primary);
                resize: vertical;
              "></textarea>
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">开奖时间 *</label>
              <input id="draw-time" type="datetime-local" value="${defaultTime}" style="
                width: 100%;
                padding: 8px;
                border: 1px solid var(--primary-low);
                border-radius: 4px;
                background: var(--secondary);
                color: var(--primary);
              ">
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">获奖人数</label>
              <input id="winners-count" type="number" value="1" min="1" max="50" style="
                width: 100%;
                padding: 8px;
                border: 1px solid var(--primary-low);
                border-radius: 4px;
                background: var(--secondary);
                color: var(--primary);
              ">
              <small style="color: var(--primary-medium);">如果填写了指定楼层，此项将被忽略</small>
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">指定中奖楼层（可选）</label>
              <input id="specified-posts" type="text" placeholder="例如：8,18,28" style="
                width: 100%;
                padding: 8px;
                border: 1px solid var(--primary-low);
                border-radius: 4px;
                background: var(--secondary);
                color: var(--primary);
              ">
              <small style="color: var(--primary-medium);">用逗号分隔楼层号，填写此项将覆盖随机抽奖</small>
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">参与门槛 *</label>
              <input id="min-participants" type="number" value="5" min="${siteSettings.lottery_min_participants_global || 5}" style="
                width: 100%;
                padding: 8px;
                border: 1px solid var(--primary-low);
                border-radius: 4px;
                background: var(--secondary);
                color: var(--primary);
              ">
              <small style="color: var(--primary-medium);">最少需要多少人参与才能开奖（不能低于${siteSettings.lottery_min_participants_global || 5}人）</small>
            </div>

            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">补充说明（可选）</label>
              <textarea id="additional-notes" placeholder="其他需要说明的内容" rows="2" style="
                width: 100%;
                padding: 8px;
                border: 1px solid var(--primary-low);
                border-radius: 4px;
                background: var(--secondary);
                color: var(--primary);
                resize: vertical;
              "></textarea>
            </div>

            <div style="text-align: center;">
              <button onclick="insertLottery()" style="
                background: var(--tertiary);
                color: var(--secondary);
                border: none;
                padding: 12px 24px;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
                font-weight: bold;
              ">插入抽奖</button>
              <button onclick="this.closest('.lottery-form-modal').remove()" style="
                background: var(--primary-low);
                color: var(--primary);
                border: none;
                padding: 12px 24px;
                border-radius: 4px;
                cursor: pointer;
              ">取消</button>
            </div>
          </div>
        `;

        document.body.appendChild(modal);

        // 插入抽奖逻辑
        window.insertLottery = function() {
          const prizeName = document.getElementById('prize-name').value.trim();
          const prizeDetails = document.getElementById('prize-details').value.trim();
          const drawTime = document.getElementById('draw-time').value;
          const winnersCount = document.getElementById('winners-count').value;
          const specifiedPosts = document.getElementById('specified-posts').value.trim();
          const minParticipants = document.getElementById('min-participants').value;
          const additionalNotes = document.getElementById('additional-notes').value.trim();

          // 验证必填字段
          if (!prizeName || !prizeDetails || !drawTime) {
            alert('请填写所有必填字段！');
            return;
          }

          // 验证时间
          const drawDate = new Date(drawTime);
          if (drawDate <= new Date()) {
            alert('开奖时间必须是未来时间！');
            return;
          }

          // 验证参与门槛
          const globalMin = siteSettings.lottery_min_participants_global || 5;
          if (parseInt(minParticipants) < globalMin) {
            alert(`参与门槛不能低于${globalMin}人！`);
            return;
          }

          // 构建抽奖内容
          let lotteryContent = `\n[lottery]\n`;
          lotteryContent += `活动名称：${prizeName}\n`;
          lotteryContent += `奖品说明：${prizeDetails}\n`;
          lotteryContent += `开奖时间：${drawTime}\n`;
          
          if (specifiedPosts) {
            lotteryContent += `指定楼层：${specifiedPosts}\n`;
          } else {
            lotteryContent += `获奖人数：${winnersCount}\n`;
          }
          
          lotteryContent += `参与门槛：${minParticipants}\n`;
          
          if (additionalNotes) {
            lotteryContent += `补充说明：${additionalNotes}\n`;
          }
          
          lotteryContent += `[/lottery]\n\n`;

          console.log("🎲 插入抽奖内容");
          
          // 插入内容到编辑器
          toolbarEvent.applySurround(lotteryContent, "", "");
          
          // 关闭模态框
          modal.remove();
          
          console.log("🎲 抽奖内容已插入");
        };

        // 点击外部关闭
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.remove();
          }
        });

        // ESC键关闭
        const handleEsc = (e) => {
          if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEsc);
          }
        };
        document.addEventListener('keydown', handleEsc);
      }

      console.log("🎲 Lottery: 工具栏集成完成");
    });
  },
};
