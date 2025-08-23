import { apiInitializer } from "discourse/lib/api";
import LotteryFormModal from "discourse/components/modal/lottery-form-modal";

export default apiInitializer("1.0.0", (api) => {
  console.log("🎲 抽奖插件初始化开始...");

  // 检查当前分类是否允许抽奖
  function canInsertLottery() {
    const composer = api.container.lookup("controller:composer");
    if (!composer) {
      console.log("🎲 未找到编辑器");
      return false;
    }

    const allowedCategories = composer.siteSettings?.lottery_allowed_categories;
    console.log("🎲 允许的分类设置:", allowedCategories);

    if (!allowedCategories) {
      console.log("🎲 未配置允许的分类");
      return false;
    }

    const allowedIds = allowedCategories
      .split("|")
      .map(id => Number(id.trim()))
      .filter(id => !isNaN(id) && id > 0);

    const currentCategoryId = Number(composer.get("model.categoryId") || 0);

    console.log("🎲 允许的分类ID:", allowedIds);
    console.log("🎲 当前分类ID:", currentCategoryId);
    console.log("🎲 是否允许插入抽奖:", allowedIds.includes(currentCategoryId));

    return allowedIds.includes(currentCategoryId);
  }

  // 添加工具栏按钮
  api.onToolbarCreate((toolbar) => {
    console.log("🎲 正在添加抽奖工具栏按钮");

    toolbar.addButton({
      id: "lottery-insert",
      group: "extras",
      icon: "dice",
      title: "插入抽奖",
      className: "lottery-toolbar-btn",
      perform: (editor) => {
        console.log("🎲 抽奖按钮被点击");

        if (!canInsertLottery()) {
          alert("当前分类不支持抽奖功能，请在管理后台设置的允许分类中创建主题");
          return;
        }

        // 获取模态服务
        const modal = api.container.lookup("service:modal");
        const composer = api.container.lookup("controller:composer");
        
        console.log("🎲 正在显示抽奖表单模态框");

        // 显示模态框
        modal.show(LotteryFormModal, {
          model: {
            // 传递插入文本的回调函数
            insertLotteryContent: (lotteryData) => {
              console.log("🎲 正在插入抽奖内容:", lotteryData);

              // 缓存数据供发布时使用
              window.lotteryFormDataCache = lotteryData;

              // 创建占位符文本
              const placeholder = `\n\n[lottery]\n活动名称：${lotteryData.prize_name}\n奖品说明：${lotteryData.prize_details}\n开奖时间：${lotteryData.draw_time}\n[/lottery]\n\n`;

              // 插入到编辑器
              const currentText = composer.get("model.reply") || "";
              composer.set("model.reply", currentText + placeholder);

              console.log("🎲 抽奖内容插入成功");
            },
            // 传递站点设置
            siteSettings: composer.siteSettings
          }
        });
      }
    });

    console.log("🎲 抽奖工具栏按钮添加成功");
  });

  console.log("🎲 抽奖插件初始化完成");
});
