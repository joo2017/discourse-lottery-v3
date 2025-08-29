import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryFormModal from "../components/modal/lottery-form-modal";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("抽奖工具栏初始化开始...");

      // 检查分类是否允许抽奖
      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) {
          console.log("未找到编辑器控制器");
          return false;
        }

        const siteSettings = api.container.lookup("service:site-settings");
        const allowedCategories = siteSettings?.lottery_allowed_categories;
        
        console.log("允许的分类设置:", allowedCategories);
        
        if (!allowedCategories) {
          console.log("未配置允许的分类，默认允许所有分类");
          return true;
        }

        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);

        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        
        console.log("允许的分类ID数组:", allowedIds);
        console.log("当前分类ID:", currentCategoryId);
        console.log("是否允许插入抽奖:", allowedIds.includes(currentCategoryId));
        
        return allowedIds.includes(currentCategoryId);
      }

      // 添加工具栏按钮
      api.onToolbarCreate((toolbar) => {
        console.log("正在向工具栏添加抽奖按钮");

        toolbar.addButton({
          title: "插入抽奖",
          id: "insertLottery", 
          group: "extras",
          icon: "dice",
          shortcut: "Ctrl+Shift+L",
          perform: (e) => {
            console.log("抽奖按钮被点击");

            // 检查功能是否启用
            const siteSettings = api.container.lookup("service:site-settings");
            if (!siteSettings?.lottery_enabled) {
              alert("抽奖功能已被管理员关闭");
              return;
            }

            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能，请在管理后台配置的允许分类中创建主题");
              return;
            }

            // 显示抽奖表单模态框
            const modal = api.container.lookup("service:modal");
            const composer = api.container.lookup("controller:composer");
            
            modal.show(LotteryFormModal, {
              model: { 
                toolbarEvent: e,
                composer: composer,
                siteSettings: siteSettings
              }
            });
          }
        });

        console.log("抽奖按钮已成功添加到工具栏");
      });

      console.log("抽奖工具栏插件初始化完成");
    });
  },
};
