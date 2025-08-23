import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Official correct lottery toolbar initializer starting...");
      
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

      // 修改 composer 控制器以支持模态框状态
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        // 添加状态跟踪
        lotteryModalVisible: false,

        actions: {
          openLotteryModal() {
            console.log("🎲 Opening lottery modal - official way");
            
            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能，请在管理后台设置的允许分类中创建主题");
              return;
            }

            // 使用官方推荐的声明式方式
            this.set('lotteryModalVisible', true);
            this.set('lotteryModalModel', {
              onSubmit: handleLotterySubmit
            });
          },

          closeLotteryModal(result) {
            console.log("🎲 Closing lottery modal with result:", result);
            
            // 如果有结果数据，处理提交
            if (result && result.prize_name) {
              handleLotterySubmit(result);
            }
            
            // 隐藏模态框
            this.set('lotteryModalVisible', false);
            this.set('lotteryModalModel', null);
          }
        }
      });

      // 工具栏按钮
      api.onToolbarCreate((toolbar) => {
        console.log("🎲 Adding official lottery button to toolbar");
        
        toolbar.addButton({
          id: "lottery-insert",
          group: "extras",
          icon: "dice",
          title: "创建抽奖活动",
          className: "lottery-toolbar-btn",
          shortcut: "Ctrl+L",
          perform: () => {
            console.log("🎲 Official lottery button clicked");
            const composer = api.container.lookup("controller:composer");
            if (composer) {
              composer.send('openLotteryModal');
            }
          },
          condition: () => canInsertLottery()
        });
        
        console.log("🎲 Official lottery button added to toolbar");
      });

      console.log("🎲 Official correct lottery toolbar setup completed");
    });
  },
};
