import { NgModule } from '@angular/core';
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

@NgModule({
  declarations: [
    AppComponent,
    InicioComponent,
    LoginComponent,
    CrearGrupoModalComponent,
    MediaStreamDirective,
    PasswordResetComponent,
    AdministracionComponent
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
  bootstrap: [AppComponent]
})
export class AppModule { }
