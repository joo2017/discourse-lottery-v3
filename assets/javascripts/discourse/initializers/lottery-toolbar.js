import { withPluginApi } from "discourse/lib/plugin-api";
import { getOwner } from "@ember/application";
import LotteryModal from "discourse/components/modal/lottery-modal"; // 下面新建

export default {
  name: "discourse-lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      api.onToolbarCreate((toolbar) => {
        toolbar.addButton({
          id: "lottery-insert",
          group: "extras",
          icon: "dice",
          title: "创建抽奖活动",
          sendAction: () => {
            const composer = api.container.lookup("service:composer");
            if (!composer) {
              alert("请先新建主题或回复后再使用抽奖按钮。");
              return;
            }
            // 调用新版 modal
            const modalService = getOwner(this).lookup("service:modal");
            modalService.show(LotteryModal, {
              model: {
                onSubmit: (data) => {
                  // 插入到回复区
                  let text = composer.model.reply || "";
                  text += `\n[lottery]\n活动名称：${data.prize_name}\n奖品说明：${data.prize_details}\n开奖时间：${data.draw_time}\n[/lottery]\n`;
                  composer.model.reply = text;
                }
              }
            });
          },
        });
      });
    });
  }
};
