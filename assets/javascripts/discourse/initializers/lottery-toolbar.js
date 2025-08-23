import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Fixed lottery toolbar initializer starting...");
      
      // 检查分类是否允许抽奖
      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) return false;
        
        const allowedCategories = composer.siteSettings?.lottery_allowed_categories;
        if (!allowedCategories) return false;
        
        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);
        
        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        return allowedIds.includes(currentCategoryId);
      }

      // 处理抽奖数据提交
      function handleLotterySubmit(lotteryData) {
        console.log("🎲 Lottery data submitted:", lotteryData);
        
        const composer = api.container.lookup("controller:composer");
        if (!composer) return;

        // 缓存数据
        window.lotteryFormDataCache = lotteryData;
        
        // 插入占位符
        const placeholder = `\n\n[lottery]\n活动名称：${lotteryData.prize_name}\n奖品说明：${lotteryData.prize_details}\n开奖时间：${lotteryData.draw_time}\n[/lottery]\n\n`;
        const currentText = composer.get("model.reply") || "";
        composer.set("model.reply", currentText + placeholder);
        
        console.log("🎲 Inserted lottery placeholder into composer");
      }

      // 修改 composer 控制器 - 使用声明式模态框
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        // 添加模态框可见性状态
        showLotteryModal: false,

        // 确保 actions 对象存在
        init() {
          this._super(...arguments);
          console.log("🎲 Composer controller initialized");
          if (!this.actions) {
            this.actions = {};
          }
        },

        actions: {
          // 打开抽奖模态框
          openLotteryModal() {
            console.log("🎲 Opening lottery modal via composer action");
            
            if (!canInsertLottery()) {
              console.log("🎲 Cannot insert lottery in current category");
              return;
            }

            // 设置模态框为可见 (声明式方式)
            this.set('showLotteryModal', true);
            console.log("🎲 Set showLotteryModal to true");
          },

          // 关闭抽奖模态框
          closeLotteryModal(data) {
            console.log("🎲 Closing lottery modal", data);
            
            // 处理提交的数据
            if (data && data.prize_name) {
              handleLotterySubmit(data);
            }
            
            // 隐藏模态框
            this.set('showLotteryModal', false);
            console.log("🎲 Set showLotteryModal to false");
          }
        }
      });

      // 工具栏按钮
      api.onToolbarCreate((toolbar) => {
        console.log("🎲 Adding fixed lottery button to toolbar");
        
        toolbar.addButton({
          id: "lottery-insert",
          group: "extras",
          icon: "dice",
          title: "创建抽奖活动",
          className: "lottery-toolbar-btn",
          shortcut: "Ctrl+L",
          perform: () => {
            console.log("🎲 Fixed lottery button clicked");
            
            const composer = api.container.lookup("controller:composer");
            if (composer) {
              console.log("🎲 Found composer, checking for actions");
              console.log("🎲 Composer actions:", Object.keys(composer.actions || {}));
              
              // 方法1: 尝试直接调用 send
              try {
                if (composer.send) {
                  console.log("🎲 Using composer.send");
                  composer.send('openLotteryModal');
                  return;
                }
              } catch (e) {
                console.log("🎲 composer.send failed:", e.message);
              }
              
              // 方法2: 尝试直接调用 action 方法
              try {
                if (composer.actions && composer.actions.openLotteryModal) {
                  console.log("🎲 Using composer.actions.openLotteryModal");
                  composer.actions.openLotteryModal.call(composer);
                  return;
                }
              } catch (e) {
                console.log("🎲 composer.actions.openLotteryModal failed:", e.message);
              }
              
              // 方法3: 直接设置状态
              console.log("🎲 Directly setting showLotteryModal state");
              if (!canInsertLottery()) {
                alert("当前分类不支持抽奖功能");
                return;
              }
              composer.set('showLotteryModal', true);
              
            } else {
              console.error("🎲 No composer found");
            }
          },
          condition: () => canInsertLottery()
        });
        
        console.log("🎲 Fixed lottery button added to toolbar");
      });

      console.log("🎲 Fixed lottery toolbar setup completed");
    });
  },
};
