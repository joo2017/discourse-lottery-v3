// assets/javascripts/discourse/initializers/lottery-composer-integration.js
// 基于discourse-calendar实际工作方式的修复版本

import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-composer-integration",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 Lottery: Initializing toolbar integration");

      const siteSettings = api.container.lookup("service:site-settings");
      
      if (!siteSettings.lottery_enabled) {
        console.log("🎲 Lottery disabled");
        return;
      }

      // 检查分类权限
      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) return false;

        const allowedCategories = siteSettings.lottery_allowed_categories;
        if (!allowedCategories) return true;

        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);

        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        return allowedIds.length === 0 || allowedIds.includes(currentCategoryId);
      }

      // 修复1: 使用正确的工具栏API
      api.onToolbarCreate((toolbar) => {
        console.log("🎲 Adding toolbar button");
        
        toolbar.addButton({
          title: "插入抽奖",
          id: "insertLottery", 
          group: "extras",
          icon: "dice",
          perform: (e) => {
            console.log("🎲 Toolbar button clicked");
            
            if (!siteSettings.lottery_enabled) {
              showCenteredAlert("抽奖功能已被管理员关闭");
              return;
            }

            if (!canInsertLottery()) {
              showCenteredAlert("当前分类不支持抽奖功能");
              return;
            }

            // 修复2: 直接插入模板到编辑器
            insertLotteryTemplate(e);
          }
        });
      });

      // 修复3: 使用居中显示的提示框
      function showCenteredAlert(message) {
        // 尝试使用Discourse的dialog服务
        try {
          const dialog = api.container.lookup("service:dialog");
          if (dialog && dialog.alert) {
            dialog.alert(message);
            return;
          }
        } catch (e) {
          console.log("🎲 Dialog service not available, using custom modal");
        }

        // 备用方案：创建自定义居中模态框
        createCenteredModal(message);
      }

      function createCenteredModal(message) {
        // 移除现有模态框
        const existingModal = document.querySelector('.lottery-alert-modal');
        if (existingModal) {
          existingModal.remove();
        }

        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'lottery-alert-modal';
        modal.innerHTML = `
          <div class="lottery-modal-overlay">
            <div class="lottery-modal-content">
              <div class="lottery-modal-message">${message}</div>
              <button class="lottery-modal-ok btn btn-primary">确定</button>
            </div>
          </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
          .lottery-alert-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 9999;
          }
          .lottery-modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .lottery-modal-content {
            background: var(--secondary);
            color: var(--primary);
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            text-align: center;
            max-width: 400px;
            margin: 20px;
          }
          .lottery-modal-message {
            margin-bottom: 20px;
            font-size: 16px;
            line-height: 1.5;
          }
          .lottery-modal-ok {
            min-width: 80px;
          }
        `;
        document.head.appendChild(style);

        // 添加到页面
        document.body.appendChild(modal);

        // 绑定关闭事件
        const okButton = modal.querySelector('.lottery-modal-ok');
        const overlay = modal.querySelector('.lottery-modal-overlay');

        function closeModal() {
          modal.remove();
          style.remove();
        }

        okButton.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            closeModal();
          }
        });

        // ESC键关闭
        function handleEscape(e) {
          if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
          }
        }
        document.addEventListener('keydown', handleEscape);
      }

      // 插入抽奖模板
      function insertLotteryTemplate(toolbarEvent) {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const defaultTime = tomorrow.toISOString().slice(0, 16);
        
        const template = `\n[lottery]\n活动名称：请填写活动名称\n奖品说明：请描述奖品详情\n开奖时间：${defaultTime}\n获奖人数：1\n参与门槛：5\n补充说明：（可选）请填写补充说明\n[/lottery]\n\n`;
        
        console.log("🎲 Inserting lottery template");
        toolbarEvent.applySurround(template, "", "");
      }

      // 修复4: 确保按钮样式正确
      api.decorateCooked(() => {
        // 确保工具栏按钮可见和可点击
        setTimeout(() => {
          const button = document.querySelector('.d-editor-button-bar #insertLottery');
          if (button) {
            button.style.pointerEvents = 'auto';
            button.style.display = 'inline-flex';
            console.log("🎲 Toolbar button found and styled");
          }
        }, 100);
      });

      console.log("🎲 Lottery: Toolbar integration completed");
    });
  },
};
