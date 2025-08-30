// assets/javascripts/discourse/components/modal/lottery-form-modal.js (CORRECTED AND COMPLETE CODE)
import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { isBlank, isPresent } from "@ember/utils";
import { ajax } from "discourse/lib/ajax";

export default class LotteryFormModal extends Component {
  @service modal;
  @service site;
  @service appEvents;
  @service dialog;

  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";
  @tracked prizeImage = "";
  @tracked prizeImagePreview = "";
  @tracked isImageUploading = false;
  @tracked isLoading = false;
  @tracked flash = "";
  @tracked flashType = "";
  @tracked validationErrors = {};

  constructor(owner, args) {
    super(owner, args);
    this.initializeDefaults();
  }

  initializeDefaults() {
    this.minParticipants = this.globalMinParticipants;
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    this.drawTime = new Date(defaultTime.getTime() - (defaultTime.getTimezoneOffset() * 60000))
                    .toISOString().slice(0, 16);
  }

  get globalMinParticipants() {
    return this.args.model?.siteSettings?.lottery_min_participants_global || 5;
  }

  get isValid() {
    this.validationErrors = {};
    let isValid = true;
    if (isBlank(this.prizeName)) { isValid = false; }
    if (isBlank(this.prizeDetails)) { isValid = false; }
    if (isBlank(this.drawTime)) { isValid = false; }
    else {
      const drawDate = new Date(this.drawTime);
      if (isNaN(drawDate.getTime()) || drawDate <= new Date()) { isValid = false; }
    }
    if (this.minParticipants < this.globalMinParticipants) { isValid = false; }
    return isValid;
  }

  @action updatePrizeName(event) { this.prizeName = event.target.value; }
  @action updatePrizeDetails(event) { this.prizeDetails = event.target.value; }
  @action updateDrawTime(event) { this.drawTime = event.target.value; }
  @action updateWinnersCount(event) { this.winnersCount = parseInt(event.target.value, 10) || 1; }
  @action updateSpecifiedPosts(event) { this.specifiedPosts = event.target.value; }
  @action updateMinParticipants(event) { this.minParticipants = parseInt(event.target.value, 10) || this.globalMinParticipants; }
  @action updateBackupStrategy(event) { this.backupStrategy = event.target.value; }
  @action updateAdditionalNotes(event) { this.additionalNotes = event.target.value; }
  @action showFlash(message, type = "error") { this.flash = message; this.flashType = type; }
  @action clearFlash() { this.flash = ""; this.flashType = ""; }

  @action async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { return this.dialog.alert("请选择一个有效的图片文件。"); }
    if (file.size > (3 * 1024 * 1024)) { return this.dialog.alert("图片文件大小不能超过 3MB。"); }
    this.isImageUploading = true;
    this.clearFlash();
    try {
      const reader = new FileReader();
      reader.onload = (e) => { this.prizeImagePreview = e.target.result; };
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_type', 'composer');
      const response = await ajax('/uploads.json', { method: 'POST', data: formData, processData: false, contentType: false });
      if (response && response.url) {
        this.prizeImage = response.url;
        this.showFlash("图片上传成功！", "success");
      } else { throw new Error('服务器返回的上传数据格式不正确'); }
    } catch (error) {
      this.dialog.alert(`图片上传失败: ${error.message || '未知错误'}`);
      this.prizeImagePreview = "";
    } finally { this.isImageUploading = false; }
  }

  @action removeImage() {
    this.prizeImage = "";
    this.prizeImagePreview = "";
    const fileInput = document.getElementById('lottery-image-upload');
    if (fileInput) { fileInput.value = ''; }
  }

  @action async submit() {
    this.clearFlash();
    if (!this.isValid) { this.showFlash("请检查表单，确保所有必填项都已正确填写。"); return; }
    this.isLoading = true;
    try {
      const lotteryData = {
        prize_name: this.prizeName.trim(), prize_details: this.prizeDetails.trim(),
        draw_time: this.drawTime.trim(), winners_count: this.winnersCount,
        specified_posts: this.specifiedPosts.trim(), min_participants: this.minParticipants,
        backup_strategy: this.backupStrategy, additional_notes: this.additionalNotes.trim(),
        prize_image: this.prizeImage.trim()
      };
      const composer = this.args.model.composer;
      const model = composer.get("model");
      const lotteryJSON = JSON.stringify(lotteryData);

      model.set("lottery", lotteryJSON);

      const placeholder = this.buildLotteryPlaceholder(lotteryData);
      this.appEvents.trigger("composer:insert-text", placeholder);
      this.showFlash("抽奖信息已成功插入！", "success");
      setTimeout(() => { this.args.closeModal(); }, 1000);
    } catch (error) {
      this.showFlash(`处理失败: ${error.message || '未知错误'}`, "error");
    } finally { this.isLoading = false; }
  }

  buildLotteryPlaceholder(lotteryData) {
    let placeholder = `\n[lottery]\n`;
    placeholder += `活动名称：${lotteryData.prize_name}\n`;
    placeholder += `奖品说明：${lotteryData.prize_details}\n`;
    placeholder += `开奖时间：${lotteryData.draw_time}\n`;
    if (lotteryData.specified_posts) {
      placeholder += `抽奖方式：指定楼层: ${lotteryData.specified_posts}\n`;
    } else {
      placeholder += `抽奖方式：随机抽取 ${lotteryData.winners_count} 人\n`;
    }
    placeholder += `参与门槛：${lotteryData.min_participants} 人\n`;
    if (lotteryData.additional_notes) { placeholder += `补充说明：${lotteryData.additional_notes}\n`; }
    if (lotteryData.prize_image) { placeholder += `奖品图片：${lotteryData.prize_image}\n`; }
    placeholder += `[/lottery]\n\n`;
    return placeholder;
  }

  @action cancel() { this.args.closeModal(); }
}
