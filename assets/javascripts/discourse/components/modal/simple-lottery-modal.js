// assets/javascripts/discourse/components/modal/simple-lottery-modal.js
// 简化版DModal组件

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { service } from "@ember/service";

export default class SimpleLotteryModal extends Component {
  @service dialog;

  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 5;
  @tracked additionalNotes = "";

  constructor(owner, args) {
    super(owner, args);
    this.initializeDefaults();
  }

  initializeDefaults() {
    const globalMin = this.args.model?.siteSettings?.lottery_min_participants_global || 5;
    this.minParticipants = globalMin;
    
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    this.drawTime = new Date(defaultTime.getTime() - (defaultTime.getTimezoneOffset() * 60000))
                    .toISOString().slice(0, 16);
  }

  get globalMinParticipants() {
    return this.args.model?.siteSettings?.lottery_min_participants_global || 5;
  }

  @action updatePrizeName(event) { this.prizeName = event.target.value; }
  @action updatePrizeDetails(event) { this.prizeDetails = event.target.value; }
  @action updateDrawTime(event) { this.drawTime = event.target.value; }
  @action updateWinnersCount(event) { this.winnersCount = parseInt(event.target.value, 10) || 1; }
  @action updateSpecifiedPosts(event) { this.specifiedPosts = event.target.value; }
  @action updateMinParticipants(event) { this.minParticipants = parseInt(event.target.value, 10) || this.globalMinParticipants; }
  @action updateAdditionalNotes(event) { this.additionalNotes = event.target.value; }

  @action submit() {
    // 验证
    if (!this.prizeName.trim() || !this.prizeDetails.trim() || !this.drawTime) {
      this.dialog.alert('请填写所有必填字段！');
      return;
    }

    const drawDate = new Date(this.drawTime);
    if (drawDate <= new Date()) {
      this.dialog.alert('开奖时间必须是未来时间！');
      return;
    }

    if (this.minParticipants < this.globalMinParticipants) {
      this.dialog.alert(`参与门槛不能低于${this.globalMinParticipants}人！`);
      return;
    }

    // 构建内容
    const lotteryContent = this.buildLotteryContent();
    
    // 返回结果
    this.args.closeModal({
      lotteryContent: lotteryContent
    });
  }

  buildLotteryContent() {
    let content = `\n[lottery]\n`;
    content += `活动名称：${this.prizeName.trim()}\n`;
    content += `奖品说明：${this.prizeDetails.trim()}\n`;
    content += `开奖时间：${this.drawTime}\n`;
    
    if (this.specifiedPosts.trim()) {
      content += `指定楼层：${this.specifiedPosts.trim()}\n`;
    } else {
      content += `获奖人数：${this.winnersCount}\n`;
    }
    
    content += `参与门槛：${this.minParticipants}\n`;
    
    if (this.additionalNotes.trim()) {
      content += `补充说明：${this.additionalNotes.trim()}\n`;
    }
    
    content += `[/lottery]\n\n`;
    
    return content;
  }

  @action cancel() {
    this.args.closeModal();
  }
}
