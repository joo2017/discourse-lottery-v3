import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Simple working lottery toolbar initializer starting...");
      
      // 检查分类是否允许抽奖的辅助函数
      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) {
          console.log("🎲 No composer found");
          return false;
        }
        
        const allowedCategories = composer.siteSettings?.lottery_allowed_categories;
        console.log("🎲 Allowed categories setting:", allowedCategories);
        
        if (!allowedCategories) {
          console.log("🎲 No allowed categories configured");
          return false;
        }
        
        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);
        
        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        
        console.log("🎲 Allowed category IDs:", allowedIds);
        console.log("🎲 Current category ID:", currentCategoryId);
        console.log("🎲 Can insert lottery:", allowedIds.includes(currentCategoryId));
        
        return allowedIds.includes(currentCategoryId);
      }

      // 处理模态框提交的函数
      function handleLotterySubmit(lotteryData) {
        console.log("🎲 Lottery data submitted:", lotteryData);
        
        const composer = api.container.lookup("controller:composer");
        if (!composer) {
          console.error("🎲 No composer found in handleLotterySubmit");
          return;
        }

        // 缓存数据供后续使用
        window.lotteryFormDataCache = lotteryData;
        
        // 在编辑器中插入占位符文本
        const placeholder = `\n\n[lottery]\n活动名称：${lotteryData.prize_name}\n奖品说明：${lotteryData.prize_details}\n开奖时间：${lotteryData.draw_time}\n[/lottery]\n\n`;
        
        // 直接修改 composer 内容
        const currentText = composer.get("model.reply") || "";
        composer.set("model.reply", currentText + placeholder);
        
        console.log("🎲 Inserted lottery placeholder into composer");
      }

      // 创建简单的 HTML 模态框
      function createSimpleModal() {
        // 创建模态框容器
        const modalContainer = document.createElement('div');
        modalContainer.className = 'lottery-simple-modal-overlay';
        modalContainer.innerHTML = `
          <div class="lottery-simple-modal">
            <div class="lottery-modal-header">
              <h3>🎲 创建抽奖活动</h3>
              <button class="lottery-close-btn">×</button>
            </div>
            <div class="lottery-modal-body">
              <div class="form-group">
                <label>活动名称 *</label>
                <input type="text" id="lottery-prize-name" placeholder="请输入活动名称">
              </div>
              <div class="form-group">
                <label>奖品说明 *</label>
                <textarea id="lottery-prize-details" placeholder="请描述奖品内容" rows="3"></textarea>
              </div>
              <div class="form-group">
                <label>开奖时间 *</label>
                <input type="datetime-local" id="lottery-draw-time">
              </div>
              <div class="form-group">
                <label>获奖人数</label>
                <input type="number" id="lottery-winners-count" value="1" min="1">
              </div>
              <div class="form-group">
                <label>指定中奖楼层（可选）</label>
                <input type="text" id="lottery-specified-posts" placeholder="例如：8,18,28">
                <small>填写此项将覆盖随机抽奖</small>
              </div>
              <div class="form-group">
                <label>参与门槛 *</label>
                <input type="number" id="lottery-min-participants" value="${api.container.lookup("controller:composer")?.siteSettings?.lottery_min_participants_global || 5}" min="1">
              </div>
            </div>
            <div class="lottery-modal-footer">
              <button class="lottery-submit-btn btn-primary">创建抽奖</button>
              <button class="lottery-cancel-btn">取消</button>
            </div>
          </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
          .lottery-simple-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
          }
          .lottery-simple-modal {
            background: var(--secondary);
            border-radius: 8px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          }
          .lottery-modal-header {
            padding: 20px;
            border-bottom: 1px solid var(--primary-low);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .lottery-modal-header h3 {
            margin: 0;
            color: var(--primary);
          }
          .lottery-close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--primary-medium);
            padding: 0;
            width: 30px;
            height: 30px;
          }
          .lottery-modal-body {
            padding: 20px;
          }
          .form-group {
            margin-bottom: 15px;
          }
          .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: var(--primary-high);
          }
          .form-group input,
          .form-group textarea {
            width: 100%;
            padding: 8px 12px;
            border: 2px solid var(--primary-low);
            border-radius: 4px;
            font-size: 14px;
            background: var(--secondary);
            color: var(--primary);
            box-sizing: border-box;
          }
          .form-group input:focus,
          .form-group textarea:focus {
            outline: none;
            border-color: var(--tertiary);
          }
          .form-group small {
            display: block;
            margin-top: 5px;
            color: var(--primary-medium);
            font-size: 12px;
          }
          .lottery-modal-footer {
            padding: 15px 20px;
            border-top: 1px solid var(--primary-low);
            display: flex;
            justify-content: flex-end;
            gap: 10px;
          }
          .lottery-submit-btn,
          .lottery-cancel-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .lottery-submit-btn {
            background: var(--tertiary);
            color: var(--secondary);
          }
          .lottery-cancel-btn {
            background: var(--primary-low);
            color: var(--primary);
          }
        `;

        // 添加事件监听
        modalContainer.addEventListener('click', (e) => {
          if (e.target === modalContainer) {
            closeModal();
          }
        });

        modalContainer.querySelector('.lottery-close-btn').addEventListener('click', closeModal);
        modalContainer.querySelector('.lottery-cancel-btn').addEventListener('click', closeModal);
        modalContainer.querySelector('.lottery-submit-btn').addEventListener('click', submitForm);

        function closeModal() {
          document.body.removeChild(modalContainer);
          document.head.removeChild(style);
        }

        function submitForm() {
          const prizeName = document.getElementById('lottery-prize-name').value.trim();
          const prizeDetails = document.getElementById('lottery-prize-details').value.trim();
          const drawTime = document.getElementById('lottery-draw-time').value.trim();
          const winnersCount = parseInt(document.getElementById('lottery-winners-count').value) || 1;
          const specifiedPosts = document.getElementById('lottery-specified-posts').value.trim();
          const minParticipants = parseInt(document.getElementById('lottery-min-participants').value) || 5;

          if (!prizeName || !prizeDetails || !drawTime) {
            alert('请填写所有必填字段');
            return;
          }

          // 验证时间
          const testDate = new Date(drawTime);
          if (isNaN(testDate.getTime()) || testDate <= new Date()) {
            alert('开奖时间无效或不能是过去时间');
            return;
          }

          const lotteryData = {
            prize_name: prizeName,
            prize_details: prizeDetails,
            draw_time: drawTime,
            winners_count: winnersCount,
            specified_posts: specifiedPosts,
            min_participants: minParticipants,
            backup_strategy: 'continue',
            additional_notes: ''
          };

          handleLotterySubmit(lotteryData);
          closeModal();
        }

        // 添加到页面
        document.head.appendChild(style);
        document.body.appendChild(modalContainer);
        
        // 聚焦到第一个输入框
        setTimeout(() => {
          document.getElementById('lottery-prize-name').focus();
        }, 100);
      }

      // 打开模态框函数
      function openLotteryModal() {
        console.log("🎲 Opening simple HTML modal");
        
        if (!canInsertLottery()) {
          alert("当前分类不支持抽奖功能，请在管理后台设置的允许分类中创建主题");
          return;
        }

        createSimpleModal();
      }

      // 使用工具栏按钮
      api.onToolbarCreate((toolbar) => {
        console.log("🎲 Toolbar created, adding simple working lottery button");
        
        toolbar.addButton({
          id: "lottery-insert",
          group: "extras",
          icon: "dice",
          title: "创建抽奖活动",
          className: "lottery-toolbar-btn",
          shortcut: "Ctrl+L",
          perform: () => {
            console.log("🎲 Simple working lottery button clicked");
            openLotteryModal();
          },
          condition: () => {
            return canInsertLottery();
          }
        });
        
        console.log("🎲 Simple working lottery button added to toolbar");
      });

      console.log("🎲 Simple working lottery toolbar initializer completed");
    });
  },
};
