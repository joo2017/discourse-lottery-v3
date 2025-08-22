import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default class LotteryForm extends Component {
  @service siteSettings;  // 注入 siteSettings 服务
  
  @tracked msg = "Hello, Discourse!";

  // 获取全局最小参与人数
  get globalMinParticipants() {
    return this.siteSettings.lottery_min_participants_global || 5;
  }

  @action
  setMsg(e) {
    this.msg = e.target.value;
  }
}
