import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryFormModal from "../components/modal/lottery-form-modal";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("0.8.31", (api) => {
      console.log("🎲 抽奖工具栏初始化开始...");

      // 检查分类是否允许抽奖
      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) {
          console.log("🎲 未找到编辑器控制器");
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
        
        console.log("🎲 允许的分类ID数组:", allowedIds);
        console.log("🎲 当前分类ID:", currentCategoryId);
        console.log("🎲 是否允许插入抽奖:", allowedIds.includes(currentCategoryId));
        
        return allowedIds.includes(currentCategoryId);
      }

      // 添加工具栏按钮
      api.onToolbarCreate((toolbar) => {
        console.log("🎲 正在向工具栏添加抽奖按钮");

        // 检查用户权限（可选）
        let currentUser = api.getCurrentUser();
        console.log("🎲 当前用户:", currentUser);

        toolbar.addButton({
          title: "插入抽奖",
          id: "insertLottery",
          group: "extras",
          icon: "dice",
          perform: (e) => {
            console.log("🎲 抽奖按钮被用户点击");

            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能，请在管理后台的允许分类中创建主题");
              return;
            }

            // 使用官方推荐的方式显示模态框
            api.container.lookup("service:modal").show(LotteryFormModal, {
              model: { 
                toolbarEvent: e,
                composer: api.container.lookup("controller:composer"),
                siteSettings: api.container.lookup("controller:composer").siteSettings
              },
            });
          },
        });

        console.log("🎲 抽奖按钮已成功添加到工具栏");
      });

      console.log("🎲 抽奖工具栏插件初始化完成");
    });
  },
};
