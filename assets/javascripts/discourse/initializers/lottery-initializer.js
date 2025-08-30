// assets/javascripts/discourse/initializers/lottery-initializer.js (ISOLATION DEBUGGING VERSION)
import { withPluginApi } from "discourse/lib/plugin-api";
// import LotteryFormModal from "../components/modal/lottery-form-modal"; // 步骤1：暂时注释掉这行导入，移除依赖

export default {
  name: "lottery-initializer",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("LOTTERY ISOLATION DEBUG: Initializer is running.");

      api.serializeOnCreate('lottery');

      api.onToolbarCreate((toolbar) => {
        // 如果您能在控制台看到下面这行字，就证明我们找对问题了！
        console.log("LOTTERY ISOLATION DEBUG: SUCCESS! onToolbarCreate hook has been triggered.");

        toolbar.addButton({
          id: "insertLottery",
          group: "extras",
          icon: "dice",
          title: "抽奖按钮 (隔离调试)",
          perform: (e) => {
            // 步骤2：暂时用一个简单的 alert 替换掉打开模态框的功能
            // 这确保了按钮的点击事件不会因为 LotteryFormModal 的问题而出错
            alert("抽奖按钮可以点击了！下一步是修复模态框。");
            
            // const modal = api.container.lookup("service:modal");
            // modal.show(LotteryFormModal, { /* ... */ });
          }
        });

        console.log("LOTTERY ISOLATION DEBUG: Lottery button should now be added to the toolbar.");
      });

      console.log("LOTTERY ISOLATION DEBUG: Initializer has finished setup.");
    });
  },
};
