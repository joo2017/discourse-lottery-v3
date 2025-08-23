import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Restored working lottery toolbar initializer starting...");
      
      // 检查分类是否允许抽奖
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

      // 处理抽奖数据提交
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

      // 只为模态框添加必要的 composer action
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        actions: {
          openLotteryModal() {
            console.log("🎲 Composer action: openLotteryModal");
            
            if (!canInsertLottery()) {
              this.dialog.alert("当前分类不支持抽奖功能，请在管理后台设置的允许分类中创建主题");
              return;
            }

            // 使用 modal service 调用模态框
            this.modal.show("lottery-modal", {
              model: {
                onSubmit: handleLotterySubmit
              }
            }).then((result) => {
              console.log("🎲 Modal closed with result:", result);
              if (result && result.prize_name) {
                handleLotterySubmit(result);
              }
            }).catch((error) => {
              console.log("🎲 Modal closed or cancelled:", error);
            });
          }
        }
      });

      // 使用之前工作的工具栏按钮方式（保持不变）
      api.onToolbarCreate((toolbar) => {
        console.log("🎲 Toolbar created, adding working lottery button");
        
        toolbar.addButton({
          id: "lottery-insert",
          group: "extras",
          icon: "dice",
          title: "创建抽奖活动",
          className: "lottery-toolbar-btn",
          shortcut: "Ctrl+L",
          perform: () => {
            console.log("🎲 Working lottery button clicked");
            
            const composer = api.container.lookup("controller:composer");
            if (composer && composer.actions && composer.actions.openLotteryModal) {
              console.log("🎲 Calling composer openLotteryModal action");
              composer.actions.openLotteryModal.call(composer);
            } else {
              console.error("🎲 Cannot find composer or openLotteryModal action");
            }
          },
          condition: () => {
            return canInsertLottery();
          }
        });
        
        console.log("🎲 Working lottery button added to toolbar");
      });

      console.log("🎲 Restored working lottery toolbar setup completed");
    });
  },
};
