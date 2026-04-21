import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { InicioComponent } from './Components/inicio/inicio/inicio.component';
import { LoginComponent } from './Components/login/login/login.component';
import { HttpClient, HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CrearGrupoModalComponent } from './Components/CrearGrupoModal/crear-grupo-modal/crear-grupo-modal.component';
import { MediaStreamDirective } from './shared/media-stream.directive';
import { AuthInterceptor } from './Service/auth/auth.interceptor';
import { PasswordResetComponent } from './Components/login/password-reset/password-reset.component';
import { AdministracionComponent } from './Components/administracion/administracion/administracion.component';
import { PerfilUsuarioComponent } from './Components/inicio/perfil-usuario/perfil-usuario.component';
import { GroupInfoPanelComponent } from './Components/inicio/group-info-panel/group-info-panel.component';
import { MessageSearchPanelComponent } from './Components/inicio/message-search-panel/message-search-panel.component';
import { EmojiPickerComponent } from './Components/inicio/emoji-picker/emoji-picker.component';
import { PollComposerComponent } from './Components/inicio/poll-composer/poll-composer.component';
import { PollVotesPanelComponent } from './Components/inicio/poll-votes-panel/poll-votes-panel.component';
import { ScheduleMessageComposerComponent } from './Components/inicio/schedule-message-composer/schedule-message-composer.component';
import { FilePreviewViewerComponent } from './Components/inicio/file-preview-viewer/file-preview-viewer.component';
import { VideoCallOverlayComponent } from './Components/inicio/video-call-overlay/video-call-overlay.component';
import { StarredMessagesPanelComponent } from './Components/inicio/starred-messages-panel/starred-messages-panel.component';
import { ChatListSkeletonComponent } from './Components/loaders/chat-list-skeleton/chat-list-skeleton.component';
import { MessagesSkeletonComponent } from './Components/loaders/messages-skeleton/messages-skeleton.component';
import { ReportChatClosurePopupComponent } from './Components/popup/report-chat-closure-popup/report-chat-closure-popup.component';
import { ReportUserPopupComponent } from './Components/popup/report-user-popup/report-user-popup.component';
import { AdminMessageComposerComponent } from './Components/administracion/admin-message-composer/admin-message-composer.component';
import { AdminEmailPreviewPopupComponent } from './Components/popup/admin-email-preview-popup/admin-email-preview-popup.component';
import { AdminScheduleSendPopupComponent } from './Components/popup/admin-schedule-send-popup/admin-schedule-send-popup.component';
import { AdminScheduledMessagesComponent } from './Components/administracion/admin-scheduled-messages/admin-scheduled-messages.component';
import { AdminReportsSectionComponent } from './Components/administracion/admin-reports-section/admin-reports-section.component';
import { AdminComplaintsSectionComponent } from './Components/administracion/admin-complaints-section/admin-complaints-section.component';
import { AdminMessagesSectionComponent } from './Components/administracion/admin-messages-section/admin-messages-section.component';
import { AdminScheduledSectionComponent } from './Components/administracion/admin-scheduled-section/admin-scheduled-section.component';
import { UsersTableSkeletonComponent } from './Components/loaders/users-table-skeleton/users-table-skeleton.component';
import { AdminPaginationComponent } from './Components/shared/admin-pagination/admin-pagination.component';

@NgModule({
  declarations: [
    AppComponent,
    InicioComponent,
    LoginComponent,
    CrearGrupoModalComponent,
    MediaStreamDirective,
    PasswordResetComponent,
    AdministracionComponent,
    PerfilUsuarioComponent,
    GroupInfoPanelComponent,
    MessageSearchPanelComponent,
    EmojiPickerComponent,
    PollComposerComponent,
    PollVotesPanelComponent,
    ScheduleMessageComposerComponent,
    FilePreviewViewerComponent,
    VideoCallOverlayComponent,
    StarredMessagesPanelComponent,
    ReportChatClosurePopupComponent,
    ReportUserPopupComponent,
    AdminMessageComposerComponent,
    AdminEmailPreviewPopupComponent,
    AdminScheduleSendPopupComponent,
    AdminScheduledMessagesComponent,
    AdminReportsSectionComponent,
    AdminComplaintsSectionComponent,
    AdminMessagesSectionComponent,
    AdminScheduledSectionComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ChatListSkeletonComponent,
    MessagesSkeletonComponent,
    UsersTableSkeletonComponent,
    AdminPaginationComponent,
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent]
})
export class AppModule { }
