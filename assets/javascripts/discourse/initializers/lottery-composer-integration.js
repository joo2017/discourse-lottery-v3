// assets/javascripts/discourse/initializers/lottery-composer-integration.js
// 修复版本 - 解决lookupFactory错误

import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-composer-integration",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 Lottery: 初始化现代工具栏集成");

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

            // 使用现代API显示抽奖模态框
            showLotteryModal(toolbarEvent, api);
          }
        });
      });

      // 显示抽奖模态框 - 修复版本
      function showLotteryModal(toolbarEvent, api) {
        console.log("🎲 显示现代抽奖表单");
        
        const modal = api.container.lookup("service:modal");
        
        // 尝试使用DModal组件
        try {
          // 检查是否有可用的组件
          const appInstance = api.container.lookup("service:app-instance") || 
                             api.container.lookup("application:main");
          
          if (appInstance) {
            // 使用import动态加载组件
            import("/assets/lottery-form-modal.js").then((module) => {
              const LotteryFormModal = module.default;
              
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
              });
            }).catch((error) => {
              console.warn("🎲 无法加载DModal组件，使用备用方案:", error);
              showFallbackLotteryForm(toolbarEvent, siteSettings, api);
            });
          } else {
            throw new Error("无法获取应用实例");
          }
        } catch (error) {
          console.warn("🎲 DModal不可用，使用备用表单:", error);
          showFallbackLotteryForm(toolbarEvent, siteSettings, api);
        }
      }

      // 备用表单方案
      function showFallbackLotteryForm(toolbarEvent, siteSettings, api) {
        console.log("🎲 显示备用抽奖表单");
        
        const modal = createModernLotteryModal(siteSettings);
        document.body.appendChild(modal);

        // 设置事件处理器
        setupModalEventHandlers(modal, toolbarEvent, siteSettings, api);

        // 聚焦第一个输入框
        const firstInput = modal.querySelector('input[type="text"]');
        if (firstInput) {
          setTimeout(() => firstInput.focus(), 100);
        }
      }

      function createModernLotteryModal(siteSettings) {
        const modal = document.createElement('div');
        modal.className = 'lottery-modal-overlay';
        
        // 获取CSS变量值
        const computedStyle = getComputedStyle(document.documentElement);
        const secondaryColor = computedStyle.getPropertyValue('--secondary').trim() || '#ffffff';
        const primaryColor = computedStyle.getPropertyValue('--primary').trim() || '#333333';
        const primaryLow = computedStyle.getPropertyValue('--primary-low').trim() || '#e6e6e6';
        const tertiaryColor = computedStyle.getPropertyValue('--tertiary').trim() || '#0088cc';
        
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
          backdrop-filter: blur(4px);
        `;

        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const defaultTime = tomorrow.toISOString().slice(0, 16);
        const globalMin = siteSettings.lottery_min_participants_global || 5;

        modal.innerHTML = `
          <div class="lottery-modal-content" style="
            background: ${secondaryColor};
            color: ${primaryColor};
            padding: 30px;
            border-radius: 12px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            margin: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            border: 1px solid ${primaryLow};
          ">
            <div class="lottery-modal-header" style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 1px solid ${primaryLow};
            ">
              <h3 style="margin: 0; color: ${primaryColor}; font-size: 20px;">🎲 创建抽奖活动</h3>
              <button class="lottery-close-btn" style="
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: ${primaryColor};
                padding: 5px;
                line-height: 1;
              ">×</button>
            </div>
            
            <form class="lottery-form" style="display: flex; flex-direction: column; gap: 16px;">
              <div class="form-field">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: ${primaryColor};">
                  活动名称 <span style="color: #dc3545;">*</span>
                </label>
                <input name="prizeName" type="text" placeholder="例如：iPhone 15 Pro 抽奖" required style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid ${primaryLow};
                  border-radius: 6px;
                  background: ${secondaryColor};
                  color: ${primaryColor};
                  box-sizing: border-box;
                  font-size: 14px;
                  transition: border-color 0.2s ease;
                " />
              </div>

              <div class="form-field">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: ${primaryColor};">
                  奖品说明 <span style="color: #dc3545;">*</span>
                </label>
                <textarea name="prizeDetails" placeholder="详细描述奖品内容，如颜色、规格、数量等" rows="3" required style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid ${primaryLow};
                  border-radius: 6px;
                  background: ${secondaryColor};
                  color: ${primaryColor};
                  resize: vertical;
                  box-sizing: border-box;
                  font-size: 14px;
                  font-family: inherit;
                  transition: border-color 0.2s ease;
                "></textarea>
              </div>

              <div class="form-field">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: ${primaryColor};">
                  开奖时间 <span style="color: #dc3545;">*</span>
                </label>
                <input name="drawTime" type="datetime-local" value="${defaultTime}" required style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid ${primaryLow};
                  border-radius: 6px;
                  background: ${secondaryColor};
                  color: ${primaryColor};
                  box-sizing: border-box;
                  font-size: 14px;
                  transition: border-color 0.2s ease;
                " />
              </div>

              <div class="form-field">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: ${primaryColor};">
                  获奖人数
                </label>
                <input name="winnersCount" type="number" value="1" min="1" max="50" style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid ${primaryLow};
                  border-radius: 6px;
                  background: ${secondaryColor};
                  color: ${primaryColor};
                  box-sizing: border-box;
                  font-size: 14px;
                  transition: border-color 0.2s ease;
                " />
                <small style="color: #6c757d; font-size: 12px; margin-top: 4px; display: block;">
                  如果填写了指定楼层，此项将被忽略
                </small>
              </div>

              <div class="form-field">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: ${primaryColor};">
                  指定中奖楼层（可选）
                </label>
                <input name="specifiedPosts" type="text" placeholder="例如：8,18,28" style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid ${primaryLow};
                  border-radius: 6px;
                  background: ${secondaryColor};
                  color: ${primaryColor};
                  box-sizing: border-box;
                  font-size: 14px;
                  transition: border-color 0.2s ease;
                " />
                <small style="color: #6c757d; font-size: 12px; margin-top: 4px; display: block;">
                  用逗号分隔楼层号，填写此项将覆盖随机抽奖
                </small>
              </div>

              <div class="form-field">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: ${primaryColor};">
                  参与门槛 <span style="color: #dc3545;">*</span>
                </label>
                <input name="minParticipants" type="number" value="${globalMin}" min="${globalMin}" required style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid ${primaryLow};
                  border-radius: 6px;
                  background: ${secondaryColor};
                  color: ${primaryColor};
                  box-sizing: border-box;
                  font-size: 14px;
                  transition: border-color 0.2s ease;
                " />
                <small style="color: #6c757d; font-size: 12px; margin-top: 4px; display: block;">
                  最少需要多少人参与才能开奖（不能低于${globalMin}人）
                </small>
              </div>

              <div class="form-field">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: ${primaryColor};">
                  补充说明（可选）
                </label>
                <textarea name="additionalNotes" placeholder="其他需要说明的内容" rows="2" style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid ${primaryLow};
                  border-radius: 6px;
                  background: ${secondaryColor};
                  color: ${primaryColor};
                  resize: vertical;
                  box-sizing: border-box;
                  font-size: 14px;
                  font-family: inherit;
                  transition: border-color 0.2s ease;
                "></textarea>
              </div>
            </form>

            <div class="lottery-modal-footer" style="
              display: flex;
              justify-content: flex-end;
              gap: 12px;
              margin-top: 24px;
              padding-top: 20px;
              border-top: 1px solid ${primaryLow};
            ">
              <button type="button" class="lottery-cancel-btn" style="
                background: ${primaryLow};
                color: ${primaryColor};
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
              ">取消</button>
              <button type="button" class="lottery-submit-btn" style="
                background: ${tertiaryColor};
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                font-size: 14px;
                transition: all 0.2s ease;
              ">插入抽奖</button>
            </div>
          </div>
        `;

        return modal;
      }

      function setupModalEventHandlers(modal, toolbarEvent, siteSettings, api) {
        const form = modal.querySelector('.lottery-form');
        const submitBtn = modal.querySelector('.lottery-submit-btn');
        const cancelBtn = modal.querySelector('.lottery-cancel-btn');
        const closeBtn = modal.querySelector('.lottery-close-btn');

        // 输入框焦点样式
        const inputs = modal.querySelectorAll('input, textarea');
        inputs.forEach(input => {
          input.addEventListener('focus', function() {
            this.style.borderColor = 'var(--tertiary, #0088cc)';
            this.style.boxShadow = '0 0 0 2px rgba(0, 136, 204, 0.2)';
          });
          
          input.addEventListener('blur', function() {
            this.style.borderColor = 'var(--primary-low, #e6e6e6)';
            this.style.boxShadow = 'none';
          });
        });

        // 提交处理
        const handleSubmit = (event) => {
          event.preventDefault();
          
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

          // 验证
          if (!validateFormData(data, siteSettings, api)) {
            return;
          }

          // 构建并插入内容
          const lotteryContent = buildLotteryContent(data);
          console.log("🎲 插入抽奖内容");
          toolbarEvent.applySurround(lotteryContent, "", "");
          
          // 关闭模态框
          closeModal();
          console.log("🎲 抽奖内容已插入");
        };

        // 关闭处理
        const closeModal = () => {
          modal.remove();
        };

        // 绑定事件
        submitBtn.addEventListener('click', handleSubmit);
        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        form.addEventListener('submit', handleSubmit);

        // 点击背景关闭
        modal.addEventListener('click', (event) => {
          if (event.target === modal) {
            closeModal();
          }
        });

        // ESC键关闭
        const handleEsc = (event) => {
          if (event.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEsc);
          }
        };
        document.addEventListener('keydown', handleEsc);

        // 按钮悬停效果
        submitBtn.addEventListener('mouseenter', function() {
          this.style.transform = 'translateY(-1px)';
          this.style.boxShadow = '0 4px 12px rgba(0,136,204,0.3)';
        });
        
        submitBtn.addEventListener('mouseleave', function() {
          this.style.transform = 'translateY(0)';
          this.style.boxShadow = 'none';
        });

        cancelBtn.addEventListener('mouseenter', function() {
          this.style.backgroundColor = 'var(--primary-medium, #999)';
        });
        
        cancelBtn.addEventListener('mouseleave', function() {
          this.style.backgroundColor = 'var(--primary-low, #e6e6e6)';
        });
      }

      function validateFormData(data, siteSettings, api) {
        // 必填字段验证
        if (!data.prizeName || !data.prizeDetails || !data.drawTime) {
          api.container.lookup("service:dialog").alert('请填写所有必填字段！');
          return false;
        }

        // 时间验证
        const drawDate = new Date(data.drawTime);
        if (drawDate <= new Date()) {
          api.container.lookup("service:dialog").alert('开奖时间必须是未来时间！');
          return false;
        }

        // 参与门槛验证
        const globalMin = siteSettings.lottery_min_participants_global || 5;
        if (parseInt(data.minParticipants) < globalMin) {
          api.container.lookup("service:dialog").alert(`参与门槛不能低于${globalMin}人！`);
          return false;
        }

        return true;
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

      console.log("🎲 Lottery: 现代工具栏集成完成");
    });
  },
};
