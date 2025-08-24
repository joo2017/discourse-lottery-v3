import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery form initializer loaded (safe version)");
      
      // 不修改任何 Composer 方法，只监听事件
      api.onAppEvent("topic:created", (topicData) => {
        console.log("🎲 Topic created:", topicData.id);
      });
      
      // 简单的全局方法（不操作 Composer）
      window.setLotteryToComposer = function(lotteryData) {
        console.log("🎲 Lottery data received:", lotteryData);
        
        try {
          // 只保存数据，不操作 Composer
          window._tempLotteryData = lotteryData;
          console.log("🎲 Data saved temporarily");
          return true;
        } catch (error) {
          console.error("🎲 Error:", error);
          return false;
        }
      };
    });
  },
};
