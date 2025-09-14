// assets/javascripts/discourse/initializers/lottery-composer-integration.js
// CSP合规版本 - 使用DModal API

import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-composer-integration",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 Lottery: 初始化CSP合规工具栏");

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
          perform: (toolbarEvent) => {
            console.log("🎲 工具栏按钮点击");
            
            if (!siteSettings.lottery_enabled) {
              api.container.lookup("service:dialog").alert("抽奖功能已被管理员关闭");
              return;
            }

            if (!canInsertLottery()) {
              api.container.lookup("service:dialog").alert("当前分类不支持抽奖功能");
              return;
            }

            // 使用DModal API显示抽奖表单
            showLotteryModal(toolbarEvent, api);
          }
        });
      });

      // 显示抽奖模态框
      function showLotteryModal(toolbarEvent, api) {
        console.log("🎲 显示CSP合规抽奖表单");
        
        const modal = api.container.lookup("service:modal");
        const LotteryFormModal = api.container.lookupFactory("component:modal/lottery-form-modal");
        
        if (!LotteryFormModal) {
          // 如果组件不存在，使用简化版本
          showSimpleLotteryForm(toolbarEvent, siteSettings);
          return;
        }

        modal.show(LotteryFormModal, {
          model: {
            toolbarEvent: toolbarEvent,
            siteSettings: siteSettings,
            composer: toolbarEvent.composer
          }
        }).then((result) => {
          if (result?.lotteryContent) {
            console.log("🎲 插入抽奖内容到编辑器");
            toolbarEvent.applySurround(result.lotteryContent, "", "");
          }
        }).catch((error) => {
          console.error("🎲 模态框错误:", error);
          // 降级到简化表单
          showSimpleLotteryForm(toolbarEvent, siteSettings);
        });
      }

      // 降级简化表单（CSP合规）
      function showSimpleLotteryForm(toolbarEvent, siteSettings) {
        console.log("🎲 显示简化抽奖表单");
        
        const modal = createSimpleLotteryModal(siteSettings);
        document.body.appendChild(modal);

        // 使用事件委托处理点击事件
        const handleModalClick = (event) => {
          if (event.target.matches('.lottery-submit-btn')) {
            event.preventDefault();
            handleFormSubmit(modal, toolbarEvent, siteSettings);
          } else if (event.target.matches('.lottery-cancel-btn') || event.target === modal) {
            event.preventDefault();
            closeModal(modal, handleModalClick);
          }
        };

        modal.addEventListener('click', handleModalClick);

        // ESC键关闭
        const handleEsc = (event) => {
          if (event.key === 'Escape') {
            closeModal(modal, handleModalClick);
            document.removeEventListener('keydown', handleEsc);
          }
        };
        document.addEventListener('keydown', handleEsc);

        // 聚焦第一个输入框
        const firstInput = modal.querySelector('input[type="text"]');
        if (firstInput) {
          setTimeout(() => firstInput.focus(), 100);
        }
      }

      function createSimpleLotteryModal(siteSettings) {
        const modal = document.createElement('div');
        modal.className = 'lottery-simple-modal';
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
        const globalMin = siteSettings.lottery_min_participants_global || 5;

        modal.innerHTML = `
          <div class="lottery-modal-content" style="
            background: var(--secondary);
            color: var(--primary);
            padding: 30px;
            border-radius: 8px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            margin: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          ">
            <h3 style="margin: 0 0 20px 0; text-align: center; color: var(--primary);">创建抽奖活动</h3>
            
            <form class="lottery-form">
              <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--primary);">活动名称 *</label>
                <input name="prizeName" type="text" placeholder="例如：iPhone 15 Pro 抽奖" required style="
                  width: 100%;
                  padding: 8px;
                  border: 1px solid var(--primary-low);
                  border-radius: 4px;
                  background: var(--secondary);
                  color: var(--primary);
                  box-sizing: border-box;
                ">
              </div>

              <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--primary);">奖品说明 *</label>
                <textarea name="prizeDetails" placeholder="详细描述奖品内容" rows="3" required style="
                  width: 100%;
                  padding: 8px;
                  border: 1px solid var(--primary-low);
                  border-radius: 4px;
                  background: var(--secondary);
                  color: var(--primary);
                  resize: vertical;
                  box-sizing: border-box;
                "></textarea>
              </div>

              <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--primary);">开奖时间 *</label>
                <input name="drawTime" type="datetime-local" value="${defaultTime}" required style="
                  width: 100%;
                  padding: 8px;
                  border: 1px solid var(--primary-low);
                  border-radius: 4px;
                  background: var(--secondary);
                  color: var(--primary);
                  box-sizing: border-box;
                ">
              </div>

              <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--primary);">获奖人数</label>
                <input name="winnersCount" type="number" value="1" min="1" max="50" style="
                  width: 100%;
                  padding: 8px;
                  border: 1px solid var(--primary-low);
                  border-radius: 4px;
                  background: var(--secondary);
                  color: var(--primary);
                  box-sizing: border-box;
                ">
                <small style="color: var(--primary-medium); font-size: 12px;">如果填写了指定楼层，此项将被忽略</small>
              </div>

              <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--primary);">指定中奖楼层（可选）</label>
                <input name="specifiedPosts" type="text" placeholder="例如：8,18,28" style="
                  width: 100%;
                  padding: 8px;
                  border: 1px solid var(--primary-low);
                  border-radius: 4px;
                  background: var(--secondary);
                  color: var(--primary);
                  box-sizing: border-box;
                ">
                <small style="color: var(--primary-medium); font-size: 12px;">用逗号分隔楼层号，填写此项将覆盖随机抽奖</small>
              </div>

              <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--primary);">参与门槛 *</label>
                <input name="minParticipants" type="number" value="${globalMin}" min="${globalMin}" required style="
                  width: 100%;
                  padding: 8px;
                  border: 1px solid var(--primary-low);
                  border-radius: 4px;
                  background: var(--secondary);
                  color: var(--primary);
                  box-sizing: border-box;
                ">
                <small style="color: var(--primary-medium); font-size: 12px;">最少需要多少人参与才能开奖（不能低于${globalMin}人）</small>
              </div>

              <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--primary);">补充说明（可选）</label>
                <textarea name="additionalNotes" placeholder="其他需要说明的内容" rows="2" style="
                  width: 100%;
                  padding: 8px;
                  border: 1px solid var(--primary-low);
                  border-radius: 4px;
                  background: var(--secondary);
                  color: var(--primary);
                  resize: vertical;
                  box-sizing: border-box;
                "></textarea>
              </div>

              <div style="text-align: center; padding-top: 10px;">
                <button type="button" class="lottery-submit-btn" style="
                  background: var(--tertiary);
                  color: var(--secondary);
                  border: none;
                  padding: 12px 24px;
                  border-radius: 4px;
                  cursor: pointer;
                  margin-right: 10px;
                  font-weight: bold;
                  font-size: 14px;
                ">插入抽奖</button>
                <button type="button" class="lottery-cancel-btn" style="
                  background: var(--primary-low);
                  color: var(--primary);
                  border: none;
                  padding: 12px 24px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 14px;
                ">取消</button>
              </div>
            </form>
          </div>
        `;

        return modal;
      }

      function handleFormSubmit(modal, toolbarEvent, siteSettings) {
        const form = modal.querySelector('.lottery-form');
        const formData = new FormData(form);
        
        const data = {
          prizeName: formData.get('prizeName')?.trim(),
          prizeDetails: formData.get('prizeDetails')?.trim(),
          drawTime: formData.get('drawTime'),
          winnersCount: formData.get('winnersCount'),
          specifiedPosts: formData.get('specifiedPosts')?.trim(),
          minParticipants: formData.get('minParticipants'),
          additionalNotes: formData.get('additionalNotes')?.trim()
        };

        // 验证必填字段
        if (!data.prizeName || !data.prizeDetails || !data.drawTime) {
          api.container.lookup("service:dialog").alert('请填写所有必填字段！');
          return;
        }

        // 验证时间
        const drawDate = new Date(data.drawTime);
        if (drawDate <= new Date()) {
          api.container.lookup("service:dialog").alert('开奖时间必须是未来时间！');
          return;
        }

        // 验证参与门槛
        const globalMin = siteSettings.lottery_min_participants_global || 5;
        if (parseInt(data.minParticipants) < globalMin) {
          api.container.lookup("service:dialog").alert(`参与门槛不能低于${globalMin}人！`);
          return;
        }

        // 构建抽奖内容
        const lotteryContent = buildLotteryContent(data);
        
        console.log("🎲 插入抽奖内容");
        
        // 插入内容到编辑器
        toolbarEvent.applySurround(lotteryContent, "", "");
        
        // 关闭模态框
        closeModal(modal);
        
        console.log("🎲 抽奖内容已插入");
      }

      function buildLotteryContent(data) {
        let lotteryContent = `\n[lottery]\n`;
        lotteryContent += `活动名称：${data.prizeName}\n`;
        lotteryContent += `奖品说明：${data.prizeDetails}\n`;
        lotteryContent += `开奖时间：${data.drawTime}\n`;
        
        if (data.specifiedPosts) {
          lotteryContent += `指定楼层：${data.specifiedPosts}\n`;
        } else {
          lotteryContent += `获奖人数：${data.winnersCount}\n`;
        }
        
        lotteryContent += `参与门槛：${data.minParticipants}\n`;
        
        if (data.additionalNotes) {
          lotteryContent += `补充说明：${data.additionalNotes}\n`;
        }
        
        lotteryContent += `[/lottery]\n\n`;
        
        return lotteryContent;
      }

      function closeModal(modal, clickHandler = null) {
        if (clickHandler) {
          modal.removeEventListener('click', clickHandler);
        }
        modal.remove();
      }

      console.log("🎲 Lottery: CSP合规工具栏集成完成");
    });
  },
};
