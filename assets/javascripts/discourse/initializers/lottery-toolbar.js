import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery toolbar initializer starting...");
      
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

      // 添加工具栏按钮
      api.onToolbarCreate((toolbar) => {
        console.log("🎲 Adding lottery button to toolbar");
        
        toolbar.addButton({
          id: "lottery-insert",
          group: "extras",
          icon: "dice",
          title: "插入抽奖",
          className: "lottery-toolbar-btn",
          perform: (e) => {
            console.log("🎲 Lottery button clicked");
            
            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能，请在管理后台设置的允许分类中创建主题");
              return;
            }

            // 使用 Discourse 的模态系统
            const modal = api.container.lookup("service:modal");
            modal.show("lottery-form-modal", {
              model: {
                toolbarEvent: e
              }
            });
          }
        });
      });

      // 注册模态组件
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        actions: {
          insertLotteryContent(lotteryData) {
            console.log("🎲 Inserting lottery content:", lotteryData);
            
            // 缓存数据供发布时使用
            window.lotteryFormDataCache = lotteryData;
            
            // 创建占位符
            const placeholder = `\n\n[lottery]\n活动名称：${lotteryData.prize_name}\n奖品说明：${lotteryData.prize_details}\n开奖时间：${lotteryData.draw_time}\n[/lottery]\n\n`;
            
            // 插入到编辑器
            const currentText = this.get("model.reply") || "";
            this.set("model.reply", currentText + placeholder);
            
            console.log("🎲 Lottery content inserted successfully");
          }
        }
      });

      console.log("🎲 Lottery toolbar initialized successfully");
    });
  },
};
