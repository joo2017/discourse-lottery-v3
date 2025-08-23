import { withPluginApi } from "discourse/lib/plugin-api";
import showModal from "discourse/lib/show-modal";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 抽奖工具栏初始化开始...");

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
        console.log("🎲 添加抽奖工具栏按钮");

        toolbar.addButton({
          id: "lottery-insert",
          group: "extras",
          icon: "dice",
          title: "插入抽奖",
          className: "lottery-toolbar-btn",
          perform: () => {
            console.log("🎲 抽奖按钮被点击");

            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能");
              return;
            }

            // 使用传统的 showModal 方法，但传递新式的组件数据
            const composer = api.container.lookup("controller:composer");
            
            showModal("lottery-form", {
              model: {
                composer: composer,
                siteSettings: composer.siteSettings,
                insertLotteryContent: (lotteryData) => {
                  console.log("🎲 插入抽奖内容:", lotteryData);
                  
                  // 缓存数据供发布时使用
                  window.lotteryFormDataCache = lotteryData;
                  
                  // 创建占位符
                  const placeholder = `\n\n[lottery]\n活动名称：${lotteryData.prize_name}\n奖品说明：${lotteryData.prize_details}\n开奖时间：${lotteryData.draw_time}\n[/lottery]\n\n`;
                  
                  // 插入到编辑器
                  const currentText = composer.get("model.reply") || "";
                  composer.set("model.reply", currentText + placeholder);
                  
                  console.log("🎲 抽奖内容插入成功");
                }
              }
            });
          }
        });
      });

      console.log("🎲 抽奖工具栏初始化完成");
    });
  },
};
