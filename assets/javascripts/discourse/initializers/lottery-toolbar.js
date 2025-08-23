import { withPluginApi } from "discourse/lib/plugin-api";
import { service } from "@ember/service";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Official pattern lottery toolbar initializer starting...");
      
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

      // 修改 composer 控制器来处理抽奖功能
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        // 注入 modal service
        modal: service(),

        // 添加数据处理方法
        handleLotterySubmit(lotteryData) {
          console.log("🎲 Handling lottery submit:", lotteryData);
          
          // 缓存数据
          window.lotteryFormDataCache = lotteryData;
          
          // 插入占位符到编辑器
          const placeholder = `\n\n[lottery]\n活动名称：${lotteryData.prize_name}\n奖品说明：${lotteryData.prize_details}\n开奖时间：${lotteryData.draw_time}\n[/lottery]\n\n`;
          const currentText = this.get("model.reply") || "";
          this.set("model.reply", currentText + placeholder);
          
          console.log("🎲 Inserted lottery placeholder into composer");
        },

        actions: {
          // 打开抽奖模态框的 action
          openLotteryModal() {
            console.log("🎲 Composer action: openLotteryModal");
            
            if (!canInsertLottery()) {
              this.dialog.alert("当前分类不支持抽奖功能，请在管理后台设置的允许分类中创建主题");
              return;
            }

            // 使用现代的 modal service，按照官方文档推荐的方式
            this.modal.show("lottery-modal", {
              model: {
                onSubmit: (data) => {
                  this.handleLotterySubmit(data);
                }
              }
            }).then((result) => {
              console.log("🎲 Modal closed with result:", result);
              if (result && result.prize_name) {
                this.handleLotterySubmit(result);
              }
            }).catch((error) => {
              console.log("🎲 Modal closed or cancelled:", error);
            });
          }
        }
      });

      // 添加工具栏按钮
      api.addComposerToolbarPopupMenuOption({
        action: "openLotteryModal",
        icon: "dice",
        label: "composer.lottery.insert",
        condition: () => canInsertLottery()
      });

      console.log("🎲 Official pattern lottery toolbar setup completed");
    });
  },
};
