import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import DButton from "discourse/components/d-button";
import DModal from "discourse/components/d-modal";
import DModalCancel from "discourse/components/d-modal-cancel";
import I18n from "discourse-i18n";

export default class LotteryFormModal extends Component {
  @service siteSettings;
  @service modal;
  
  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = this.siteSettings.lottery_min_participants_global || 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";
  @tracked errors = {};

  get isValid() {
    return (
      this.prizeName.trim() &&
      this.prizeDetails.trim() &&
      this.drawTime.trim() &&
      this.minParticipants >= (this.siteSettings.lottery_min_participants_global || 5)
    );
  }

  get lotteryType() {
    return this.specifiedPosts.trim() ? "指定楼层" : "随机抽取";
  }

  @action
  updatePrizeName(event) {
    this.prizeName = event.target.value;
    if (this.errors.prizeName) delete this.errors.prizeName;
  }

  @action
  updatePrizeDetails(event) {
    this.prizeDetails = event.target.value;
    if (this.errors.prizeDetails) delete this.errors.prizeDetails;
  }

  @action
  updateDrawTime(event) {
    this.drawTime = event.target.value;
    if (this.errors.drawTime) delete this.errors.drawTime;
  }

  @action
  updateWinnersCount(event) {
    this.winnersCount = parseInt(event.target.value) || 1;
  }

  @action
  updateSpecifiedPosts(event) {
    this.specifiedPosts = event.target.value;
  }

  @action
  updateMinParticipants(event) {
    this.minParticipants = parseInt(event.target.value) || 1;
    if (this.errors.minParticipants) delete this.errors.minParticipants;
  }

  @action
  updateBackupStrategy(event) {
    this.backupStrategy = event.target.value;
  }

  @action
  updateAdditionalNotes(event) {
    this.additionalNotes = event.target.value;
  }

  @action
  validateAndSubmit() {
    this.errors = {};

    // 验证必填字段
    if (!this.prizeName.trim()) {
      this.errors.prizeName = "活动名称不能为空";
    }
    if (!this.prizeDetails.trim()) {
      this.errors.prizeDetails = "奖品说明不能为空";
    }
    if (!this.drawTime.trim()) {
      this.errors.drawTime = "开奖时间不能为空";
    }

    // 验证时间格式
    if (this.drawTime.trim()) {
      try {
        const testDate = new Date(this.drawTime);
        if (isNaN(testDate.getTime()) || testDate <= new Date()) {
          this.errors.drawTime = "开奖时间无效或不能是过去时间";
        }
      } catch (e) {
        this.errors.drawTime = "时间格式无效，请使用 YYYY-MM-DDTHH:MM 格式";
      }
    }

    // 验证最小参与人数
    const globalMin = this.siteSettings.lottery_min_participants_global || 5;
    if (this.minParticipants < globalMin) {
      this.errors.minParticipants = `参与门槛不能低于${globalMin}人`;
    }

    // 如果有错误，不提交
    if (Object.keys(this.errors).length > 0) {
      return;
    }

    // 创建抽奖数据
    const lotteryData = {
      prize_name: this.prizeName.trim(),
      prize_details: this.prizeDetails.trim(),
      draw_time: this.drawTime.trim(),
      winners_count: this.winnersCount,
      specified_posts: this.specifiedPosts.trim(),
      min_participants: this.minParticipants,
      backup_strategy: this.backupStrategy,
      additional_notes: this.additionalNotes.trim()
    };

    console.log("🎲 Lottery form submitted with data:", lotteryData);

    // 调用父组件的回调
    if (this.args.model?.onSubmit) {
      this.args.model.onSubmit(lotteryData);
    }

    // 关闭模态框
    this.modal.close();
  }

  <template>
    <DModal
      @title="创建抽奖活动"
      @closeModal={{@closeModal}}
      class="lottery-form-modal"
    >
      <:body>
        <div class="lottery-form-content">
          
          {{! 活动名称 }}
          <div class="form-group">
            <label class="form-label required">活动名称</label>
            <input
              type="text"
              class="form-input {{if this.errors.prizeName 'error'}}"
              value={{this.prizeName}}
              placeholder="请输入活动名称"
              {{on "input" this.updatePrizeName}}
            />
            {{#if this.errors.prizeName}}
              <div class="form-error">{{this.errors.prizeName}}</div>
            {{/if}}
          </div>

          {{! 奖品说明 }}
          <div class="form-group">
            <label class="form-label required">奖品说明</label>
            <textarea
              class="form-textarea {{if this.errors.prizeDetails 'error'}}"
              value={{this.prizeDetails}}
              placeholder="请描述奖品内容"
              rows="3"
              {{on "input" this.updatePrizeDetails}}
            ></textarea>
            {{#if this.errors.prizeDetails}}
              <div class="form-error">{{this.errors.prizeDetails}}</div>
            {{/if}}
          </div>

          {{! 开奖时间 }}
          <div class="form-group">
            <label class="form-label required">开奖时间</label>
            <input
              type="datetime-local"
              class="form-input {{if this.errors.drawTime 'error'}}"
              value={{this.drawTime}}
              {{on "input" this.updateDrawTime}}
            />
            <div class="form-help">选择开奖的具体日期和时间</div>
            {{#if this.errors.drawTime}}
              <div class="form-error">{{this.errors.drawTime}}</div>
            {{/if}}
          </div>

          {{! 抽奖方式选择 }}
          <div class="form-group">
            <label class="form-label">抽奖方式</label>
            <div class="lottery-type-indicator">
              当前方式：<strong>{{this.lotteryType}}</strong>
            </div>
          </div>

          {{! 获奖人数（随机抽奖时） }}
          {{#unless this.specifiedPosts.trim}}
            <div class="form-group">
              <label class="form-label">获奖人数</label>
              <input
                type="number"
                class="form-input"
                value={{this.winnersCount}}
                min="1"
                {{on "input" this.updateWinnersCount}}
              />
              <div class="form-help">随机抽奖时的获奖人数</div>
            </div>
          {{/unless}}

          {{! 指定楼层（可选） }}
          <div class="form-group">
            <label class="form-label">指定中奖楼层（可选）</label>
            <input
              type="text"
              class="form-input"
              value={{this.specifiedPosts}}
              placeholder="例如：8,18,28"
              {{on "input" this.updateSpecifiedPosts}}
            />
            <div class="form-help">填写此项将覆盖随机抽奖，用英文逗号分隔楼层号</div>
          </div>

          {{! 参与门槛 }}
          <div class="form-group">
            <label class="form-label required">参与门槛</label>
            <input
              type="number"
              class="form-input {{if this.errors.minParticipants 'error'}}"
              value={{this.minParticipants}}
              min={{this.siteSettings.lottery_min_participants_global}}
              {{on "input" this.updateMinParticipants}}
            />
            <div class="form-help">
              最少需要多少人参与（全局最小值：{{this.siteSettings.lottery_min_participants_global}}）
            </div>
            {{#if this.errors.minParticipants}}
              <div class="form-error">{{this.errors.minParticipants}}</div>
            {{/if}}
          </div>

          {{! 后备策略 }}
          <div class="form-group">
            <label class="form-label">后备策略</label>
            <select
              class="form-select"
              {{on "change" this.updateBackupStrategy}}
            >
              <option value="continue" selected={{eq this.backupStrategy "continue"}}>
                人数不足时继续开奖
              </option>
              <option value="cancel" selected={{eq this.backupStrategy "cancel"}}>
                人数不足时取消活动
              </option>
            </select>
            <div class="form-help">当开奖时参与人数不足时的处理方式</div>
          </div>

          {{! 补充说明 }}
          <div class="form-group">
            <label class="form-label">补充说明（可选）</label>
            <textarea
              class="form-textarea"
              value={{this.additionalNotes}}
              placeholder="其他需要说明的内容"
              rows="2"
              {{on "input" this.updateAdditionalNotes}}
            ></textarea>
          </div>

        </div>
      </:body>

      <:footer>
        <DButton
          @action={{this.validateAndSubmit}}
          @label="创建抽奖"
          class="btn-primary"
          @disabled={{not this.isValid}}
        />
        <DModalCancel @close={{@closeModal}} />
      </:footer>
    </DModal>
  </template>
}
