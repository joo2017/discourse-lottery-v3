// assets/javascripts/discourse/initializers/lottery-initializer.js (DEBUGGING VERSION - TO FORCE THE BUTTON TO APPEAR)
import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryFormModal from "../components/modal/lottery-form-modal";

export default {
  name: "lottery-initializer",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("LOTTERY DEBUG: Initializer is running.");

      // 数据传递的功能我们先放着，它没有问题，但现在不重要。
      api.serializeOnCreate('lottery');

      api.onToolbarCreate((toolbar) => {
        console.log("LOTTERY DEBUG: onToolbarCreate hook has been triggered.");

        // -----------------------------------------------------------
        // 调试核心：我们暂时移除所有可能出错的条件
        // -----------------------------------------------------------
        
        // 1. 移除 if (toolbar.context.creatingTopic)
        //    这能确保按钮在任何编辑器（新建、回复）里都应该出现，排除了上下文判断错误的可能性。

        // 2. 将 title 从翻译键改为一个固定的中文字符串
        //    这能排除所有 .yml 翻译文件路径错误或加载失败的可能性。这是最常见的静默失败原因。

        toolbar.addButton({
          id: "insertLottery",
          group: "extras",
          icon: "dice",
          title: "抽奖按钮 (调试)", // 直接使用写死的中文，不依赖翻译文件
          perform: (e) => {
            // 按钮点击后的逻辑暂时不重要，但我们先保留
            const modal = api.container.lookup("service:modal");
            modal.show(LotteryFormModal, {
              model: {
                composer: api.container.lookup("controller:composer"),
                siteSettings: api.container.lookup("service:site-settings")
              }
            });
          }
        });

        console.log("LOTTERY DEBUG: The lottery button should now be added to the toolbar.");
      });
    });
  },
};
