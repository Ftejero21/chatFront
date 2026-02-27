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
    EmojiPickerComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,

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
